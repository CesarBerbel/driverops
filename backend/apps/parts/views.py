from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasModulePermission

from .models import Part, StockMovement
from .serializers import PartSerializer, StockMovementSerializer


class PartViewSet(viewsets.ModelViewSet):
    serializer_class = PartSerializer
    permission_classes = [HasModulePermission]
    permission_module = "parts"
    # GET/POST do extrato exigem, no mínimo, ver peças; o POST ainda checa
    # stock_move/stock_adjust explicitamente (ver `movements`).
    permission_action_map = {"movements": "view"}

    def get_queryset(self):
        queryset = Part.objects.select_related("category", "supplier").all()

        category_id = self.request.query_params.get("category")
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if self.action != "list":
            return queryset

        status_param = self.request.query_params.get("status", "active")
        if status_param == "active":
            queryset = queryset.filter(is_active=True)
        elif status_param == "inactive":
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(internal_code__icontains=search)
                | Q(brand__icontains=search)
                | Q(category__name__icontains=search)
            )
        return queryset

    def destroy(self, request, *args, **kwargs):
        part = self.get_object()
        part.is_active = False
        part.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        part = self.get_object()
        part.is_active = True
        part.save(update_fields=["is_active", "updated_at"])
        return Response(PartSerializer(part).data)

    @action(detail=True, methods=["get", "post"], url_path="movements")
    def movements(self, request, pk=None):
        """Extrato (GET) e lançamento (POST) de movimentações de estoque.

        - Entrada/Saída exigem a permissão crítica `parts.stock_move`.
        - Ajuste (contagem física, define o saldo absoluto) exige `parts.stock_adjust`.
        - Saída não pode deixar o saldo negativo (guarda-corpo do lançamento
          manual; a baixa automática da OS é a única exceção).
        """
        part = self.get_object()

        if request.method == "GET":
            movements = part.movements.select_related("order", "created_by").all()
            return Response(StockMovementSerializer(movements, many=True).data)

        serializer = StockMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]
        quantity = serializer.validated_data["quantity"]
        reason = serializer.validated_data.get("reason", "")

        required = (
            "parts.stock_adjust"
            if kind == StockMovement.Kind.ADJUST
            else "parts.stock_move"
        )
        if not request.user.has_perm_code(required):
            return Response(
                {"detail": "Você não tem permissão para esta movimentação."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if kind != StockMovement.Kind.ADJUST and quantity <= 0:
            return Response(
                {"quantity": ["A quantidade deve ser maior que zero."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            locked = Part.objects.select_for_update().get(pk=part.pk)
            if kind == StockMovement.Kind.IN:
                resulting = locked.current_quantity + quantity
            elif kind == StockMovement.Kind.OUT:
                if quantity > locked.current_quantity:
                    return Response(
                        {
                            "quantity": [
                                "Estoque insuficiente para a saída "
                                f"(disponível: {locked.current_quantity})."
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                resulting = locked.current_quantity - quantity
            else:  # ADJUST: `quantity` é o novo saldo absoluto.
                resulting = quantity

            locked.current_quantity = resulting
            locked.save(update_fields=["current_quantity", "updated_at"])
            movement = StockMovement.objects.create(
                part=locked,
                kind=kind,
                quantity=quantity,
                resulting_quantity=resulting,
                reason=reason,
                created_by=request.user,
            )

        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )
