from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.audit import client_ip, record_audit
from apps.accounts.permissions import HasModulePermission, require_permission
from apps.customers.models import Customer
from apps.customers.utils import only_digits
from apps.orders.status_groups import OPERATIONAL_STATUSES
from apps.vehicles.models import Vehicle

from .models import (
    ContactPeriod,
    LeadEvent,
    LeadSettings,
    LeadStatus,
    RequestType,
    SiteLead,
)
from .serializers import (
    LeadDetailSerializer,
    LeadListSerializer,
    LeadSettingsSerializer,
    PublicLeadCreateSerializer,
    build_indicator_maps,
)
from .services import (
    create_customer_from_lead,
    create_os_from_lead,
    create_quote_from_lead,
    create_vehicle_from_lead,
    notify_new_lead,
    record_event,
    set_status,
)

# --- público ---------------------------------------------------------------


class PublicLeadConfigView(APIView):
    """Config pública do formulário (campos exigidos, tipos, períodos, estado)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        conf = LeadSettings.get_solo()
        return Response(
            {
                "is_active": conf.is_active,
                "email_required": conf.email_required,
                "plate_required": conf.plate_required,
                "allow_without_vehicle": conf.allow_without_vehicle,
                "require_consent": conf.require_consent,
                "request_types": [
                    {"key": k, "label": v} for k, v in RequestType.choices
                ],
                "periods": [{"key": k, "label": v} for k, v in ContactPeriod.choices],
            }
        )


class PublicLeadCreateView(APIView):
    """Recebe um pedido do site. Sem login; protegido por honeypot + rate limit."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_lead"

    def post(self, request):
        conf = LeadSettings.get_solo()
        if not conf.is_active:
            return Response(
                {"detail": "O formulário de contato está indisponível no momento."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PublicLeadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop("website", None)  # honeypot
        lead = SiteLead.objects.create(
            **data,
            ip=client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )
        notify_new_lead(lead)
        # Nunca expõe dados internos nem se a placa já existe.
        return Response(
            {
                "detail": (
                    "Pedido recebido com sucesso. A oficina foi avisada e entrará em "
                    "contato pelo telefone informado."
                )
            },
            status=status.HTTP_201_CREATED,
        )


# --- interno: inbox --------------------------------------------------------


class LeadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Inbox de pedidos do site + ações de atendimento e conversão."""

    permission_classes = [HasModulePermission]
    permission_module = "leads"
    permission_action_map = {
        "pending_count": "view",
        "note": "attend",
        "contact": "attend",
        "assign": "attend",
        "set_status_action": "attend",
        "mark_duplicate": "attend",
        "cancel": "attend",
        "link_customer": "convert",
        "create_customer": "convert",
        "update_customer": "convert",
        "link_vehicle": "convert",
        "create_vehicle": "convert",
        "convert_os": "convert",
        "convert_quote": "convert",
    }

    def get_serializer_class(self):
        return LeadDetailSerializer if self.action == "retrieve" else LeadListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        maps = getattr(self, "_indicator_maps", None)
        if maps is not None:
            ctx["indicator_maps"] = maps
        return ctx

    def list(self, request, *args, **kwargs):
        # Pré-carrega os mapas dos indicadores em lote (evita N+1 por lead).
        # `paginate_queryset` devolve a página real com `?page` (envelope
        # {count,next,previous,results}) ou, sem ele, a lista limitada ao teto.
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        self._indicator_maps = build_indicator_maps(page)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def get_queryset(self):
        from .models import CLOSED_STATUSES

        qs = SiteLead.objects.select_related(
            "assigned_to", "linked_customer", "linked_vehicle"
        )
        p = self.request.query_params
        status_param = p.get("status")
        if status_param == "open":
            # "Em aberto" = pedidos não terminais (mesmos status do badge).
            qs = qs.exclude(status__in=CLOSED_STATUSES)
        elif status_param:
            qs = qs.filter(status=status_param)
        if p.get("assigned_to"):
            qs = qs.filter(assigned_to_id=p["assigned_to"])
        if p.get("request_type"):
            qs = qs.filter(request_type=p["request_type"])
        search = p.get("q")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(name__icontains=search)
                | Q(phone__icontains=only_digits(search) or search)
                | Q(vehicle_plate__icontains=search.upper())
                | Q(email__icontains=search)
                | Q(message__icontains=search)
            )
        return qs

    def perform_update(self, serializer):
        lead = serializer.save()
        record_audit(self.request, "site_lead.update", new_value={"lead_id": lead.id})

    # --- ações de atendimento ---

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        from .models import CLOSED_STATUSES

        count = SiteLead.objects.exclude(status__in=CLOSED_STATUSES).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def note(self, request, pk=None):
        lead = self.get_object()
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "Informe a observação."})
        record_event(lead, LeadEvent.Type.NOTE, text, actor=request.user)
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"])
    def contact(self, request, pk=None):
        lead = self.get_object()
        channel = request.data.get("channel", "")
        record_event(
            lead,
            LeadEvent.Type.CONTACT,
            f"Contato registrado ({channel})".strip(),
            actor=request.user,
        )
        if lead.status in (LeadStatus.NEW, LeadStatus.IN_ANALYSIS):
            set_status(lead, LeadStatus.CONTACTED, actor=request.user)
        record_audit(request, "site_lead.contact", new_value={"lead_id": lead.id})
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        lead = self.get_object()
        user_id = request.data.get("user")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        lead.assigned_to = User.objects.filter(pk=user_id).first() if user_id else None
        lead.save(update_fields=["assigned_to", "updated_at"])
        record_event(
            lead,
            LeadEvent.Type.ASSIGN,
            (
                f"Responsável: {lead.assigned_to.full_name or lead.assigned_to.email}"
                if lead.assigned_to
                else "Responsável removido."
            ),
            actor=request.user,
        )
        record_audit(request, "site_lead.assign", new_value={"lead_id": lead.id})
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status_action(self, request, pk=None):
        lead = self.get_object()
        new_status = request.data.get("status")
        valid = {c for c, _ in LeadStatus.choices}
        if new_status not in valid:
            raise ValidationError({"status": "Status inválido."})
        set_status(lead, new_status, actor=request.user)
        record_audit(
            request,
            "site_lead.status",
            new_value={"lead_id": lead.id, "status": new_status},
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="mark-duplicate")
    def mark_duplicate(self, request, pk=None):
        lead = self.get_object()
        set_status(
            lead,
            LeadStatus.DUPLICATE,
            actor=request.user,
            description="Marcado como duplicado.",
        )
        record_audit(request, "site_lead.duplicate", new_value={"lead_id": lead.id})
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        lead = self.get_object()
        set_status(
            lead,
            LeadStatus.CANCELED,
            actor=request.user,
            description="Pedido cancelado.",
        )
        record_audit(request, "site_lead.cancel", new_value={"lead_id": lead.id})
        return Response(LeadDetailSerializer(lead).data)

    # --- vínculo / criação de cliente e veículo ---

    @action(detail=True, methods=["post"], url_path="link-customer")
    def link_customer(self, request, pk=None):
        lead = self.get_object()
        customer = Customer.objects.filter(pk=request.data.get("customer")).first()
        if customer is None:
            raise ValidationError({"customer": "Cliente não encontrado."})
        lead.linked_customer = customer
        lead.save(update_fields=["linked_customer", "updated_at"])
        record_event(
            lead,
            LeadEvent.Type.LINK_CUSTOMER,
            f"Cliente vinculado: {customer.name}.",
            actor=request.user,
        )
        record_audit(
            request,
            "site_lead.link_customer",
            new_value={"lead_id": lead.id, "customer": customer.id},
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="create-customer")
    def create_customer(self, request, pk=None):
        lead = self.get_object()
        customer = create_customer_from_lead(lead, actor=request.user)
        record_audit(
            request,
            "site_lead.create_customer",
            new_value={"lead_id": lead.id, "customer": customer.id},
        )
        return Response(LeadDetailSerializer(lead).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="update-customer")
    def update_customer(self, request, pk=None):
        lead = self.get_object()
        customer = lead.linked_customer
        if customer is None:
            raise ValidationError({"detail": "Nenhum cliente vinculado."})
        customer.phone = only_digits(lead.phone) or customer.phone
        customer.whatsapp = only_digits(lead.phone) or customer.whatsapp
        if lead.email:
            customer.email = lead.email
        if lead.document:
            customer.document = only_digits(lead.document)
        customer.save()
        record_event(
            lead,
            LeadEvent.Type.LINK_CUSTOMER,
            "Dados do cliente atualizados.",
            actor=request.user,
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="link-vehicle")
    def link_vehicle(self, request, pk=None):
        lead = self.get_object()
        vehicle = Vehicle.objects.filter(pk=request.data.get("vehicle")).first()
        if vehicle is None:
            raise ValidationError({"vehicle": "Veículo não encontrado."})
        lead.linked_vehicle = vehicle
        lead.save(update_fields=["linked_vehicle", "updated_at"])
        record_event(
            lead,
            LeadEvent.Type.LINK_VEHICLE,
            f"Veículo vinculado: {vehicle.license_plate}.",
            actor=request.user,
        )
        record_audit(
            request,
            "site_lead.link_vehicle",
            new_value={"lead_id": lead.id, "vehicle": vehicle.id},
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=["post"], url_path="create-vehicle")
    def create_vehicle(self, request, pk=None):
        lead = self.get_object()
        if lead.linked_customer is None:
            raise ValidationError(
                {"detail": "Vincule ou crie o cliente antes do veículo."}
            )
        if not lead.vehicle_plate:
            raise ValidationError(
                {"detail": "O pedido não informou a placa do veículo."}
            )
        vehicle = create_vehicle_from_lead(
            lead, actor=request.user, customer=lead.linked_customer
        )
        record_audit(
            request,
            "site_lead.create_vehicle",
            new_value={"lead_id": lead.id, "vehicle": vehicle.id},
        )
        return Response(LeadDetailSerializer(lead).data, status=status.HTTP_201_CREATED)

    # --- conversões ---

    def _guard_conversion(self, request, lead):
        conf = LeadSettings.get_solo()
        if lead.linked_customer is None or lead.linked_vehicle is None:
            raise ValidationError(
                {"detail": "Defina o cliente e o veículo antes de converter."}
            )
        # Divergência: veículo vinculado pertence a outro cliente.
        if lead.linked_vehicle.customer_id != lead.linked_customer_id:
            if conf.block_conversion_when_vehicle_other_customer:
                raise ValidationError(
                    {
                        "detail": "O veículo informado está vinculado a outro cliente. "
                        "Revise antes de gerar OS ou orçamento.",
                        "code": "vehicle_divergent",
                    }
                )
        # OS aberta para o veículo: alerta (exige confirmação explícita).
        has_open = lead.linked_vehicle.work_orders.filter(
            status__in=OPERATIONAL_STATUSES
        ).exists()
        if has_open and not request.data.get("confirm"):
            raise ValidationError(
                {
                    "detail": "Este veículo já possui uma OS aberta. Verifique antes de criar uma nova.",
                    "code": "open_os",
                }
            )
        return conf

    @action(detail=True, methods=["post"], url_path="convert-os")
    def convert_os(self, request, pk=None):
        lead = self.get_object()
        conf = self._guard_conversion(request, lead)
        if not conf.allow_create_os:
            raise PermissionDenied("A criação de OS a partir do site está desativada.")
        order = create_os_from_lead(lead, actor=request.user)
        record_audit(
            request,
            "site_lead.convert_os",
            new_value={"lead_id": lead.id, "order": order.id},
        )
        return Response(LeadDetailSerializer(lead).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="convert-quote")
    def convert_quote(self, request, pk=None):
        lead = self.get_object()
        self._guard_conversion(request, lead)
        quote = create_quote_from_lead(lead, actor=request.user)
        record_audit(
            request,
            "site_lead.convert_quote",
            new_value={"lead_id": lead.id, "quote": quote.id},
        )
        return Response(LeadDetailSerializer(lead).data, status=status.HTTP_201_CREATED)


# --- interno: configurações -------------------------------------------------


class LeadSettingsView(APIView):
    """Config do formulário/fluxo. GET=leads.view, PATCH=leads.config."""

    def get_permissions(self):
        code = "leads.config" if self.request.method == "PATCH" else "leads.view"
        return [require_permission(code)()]

    def get(self, request):
        return Response(LeadSettingsSerializer(LeadSettings.get_solo()).data)

    def patch(self, request):
        conf = LeadSettings.get_solo()
        serializer = LeadSettingsSerializer(conf, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(updated_by=request.user)
        record_audit(
            request,
            "site_lead.settings",
            new_value={"changed": list(request.data.keys())},
        )
        return Response(LeadSettingsSerializer(updated).data)
