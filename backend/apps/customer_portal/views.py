"""Endpoints PÚBLICOS do portal do cliente (sem login, acesso por token)."""

import logging

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.customers.models import CustomerInteraction
from apps.orders.models import WorkOrder
from apps.orders.pdf import render_order_pdf

from . import services
from .models import CustomerPortalSettings, PortalMessage

logger = logging.getLogger("apps.customer_portal")

# Resposta pública SEMPRE neutra -- nunca revela se a placa/e-mail existe.
NEUTRAL_MESSAGE = (
    "Se encontrarmos um veículo com estes dados, enviaremos um link de acesso "
    "para o e-mail cadastrado."
)


class VehicleAccessRequestView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "vehicle_portal"

    def post(self, request):
        # Honeypot: um campo invisível preenchido indica bot -> sucesso neutro
        # sem fazer nada.
        if (request.data.get("website") or "").strip():
            return Response({"detail": NEUTRAL_MESSAGE})
        try:
            services.request_access(
                plate=request.data.get("plate", ""),
                email=request.data.get("email", ""),
                request=request,
            )
        except Exception:  # nunca vazar erro/existência num 500
            logger.exception("customer_portal: erro ao solicitar acesso")
        return Response({"detail": NEUTRAL_MESSAGE})


class _TokenBase(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def load(self, raw):
        conf = CustomerPortalSettings.get_solo()
        token = services.resolve_token(raw)
        if token is None or not conf.enabled:
            return None, conf, ("invalid", 404)
        if not token.is_valid(single_use=conf.single_use_token):
            return None, conf, ("expired", 410)
        return token, conf, None


class VehicleAccessDetailView(_TokenBase):
    def get(self, request, token):
        obj, conf, err = self.load(token)
        if err:
            return Response({"code": err[0]}, status=err[1])
        obj.access_count += 1
        obj.access_ip = services.client_ip(request)
        obj.access_user_agent = request.META.get("HTTP_USER_AGENT", "")[:300]
        if conf.single_use_token and obj.used_at is None:
            obj.used_at = timezone.now()
        obj.save(
            update_fields=[
                "access_count",
                "access_ip",
                "access_user_agent",
                "used_at",
            ]
        )
        logger.info("customer_portal: acesso ao veículo %s", obj.vehicle_id)
        return Response(services.build_portal_payload(obj, request=request))


class VehicleAccessMessageView(_TokenBase):
    def post(self, request, token):
        obj, conf, err = self.load(token)
        if err:
            return Response({"code": err[0]}, status=err[1])
        if not conf.allow_messages:
            return Response({"detail": "Mensagens não estão habilitadas."}, status=403)
        kind = request.data.get("kind") or PortalMessage.Kind.OTHER
        if kind not in PortalMessage.Kind.values:
            kind = PortalMessage.Kind.OTHER
        message = (request.data.get("message") or "").strip()[:2000]
        if not message:
            return Response({"message": ["Escreva sua mensagem."]}, status=400)

        pm = PortalMessage.objects.create(
            token=obj,
            customer=obj.customer,
            vehicle=obj.vehicle,
            kind=kind,
            message=message,
            preferred_time=(request.data.get("preferred_time") or "").strip()[:100],
        )
        # Registro interno (Cliente 360°) para a oficina ver e retornar o contato.
        wants_contact = kind in (
            PortalMessage.Kind.CALLBACK,
            PortalMessage.Kind.PICKUP,
        )
        CustomerInteraction.objects.create(
            customer=obj.customer,
            vehicle=obj.vehicle,
            interaction_type=(
                CustomerInteraction.Type.RETURN
                if wants_contact
                else CustomerInteraction.Type.NOTE
            ),
            channel="portal",
            title=f"Mensagem do cliente (portal): {pm.get_kind_display()}",
            summary=message[:300],
            content=message,
            status=CustomerInteraction.Status.OPEN,
            next_action="Retornar contato ao cliente" if wants_contact else "",
        )
        logger.info("customer_portal: mensagem do cliente (veículo %s)", obj.vehicle_id)
        return Response(
            {"detail": "Mensagem enviada. A oficina entrará em contato."}, status=201
        )


class VehicleAccessOrderPdfView(_TokenBase):
    def get(self, request, token, order_id):
        obj, conf, err = self.load(token)
        if err:
            return Response({"code": err[0]}, status=err[1])
        if not conf.allow_pdf_download:
            return Response({"detail": "Download não habilitado."}, status=403)
        # O PDF só é servido se a OS pertence ao veículo do token.
        try:
            order = WorkOrder.objects.get(id=order_id, vehicle=obj.vehicle)
        except WorkOrder.DoesNotExist:
            return Response({"code": "not_found"}, status=404)
        response = HttpResponse(render_order_pdf(order), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="os-{order.number:04d}.pdf"'
        )
        return response
