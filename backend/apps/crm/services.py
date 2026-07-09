from datetime import timedelta

from django.utils import timezone

from apps.accounts.audit import record_audit

from .models import (
    CampaignStatus,
    CrmCampaign,
    CrmSuggestionEvent,
    CrmTask,
    SuggestionStatus,
    TaskStatus,
)


def record_event(suggestion, description, *, actor=None, from_status="", to_status=""):
    CrmSuggestionEvent.objects.create(
        suggestion=suggestion,
        description=description[:300],
        from_status=from_status,
        to_status=to_status,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
    )


def set_status(suggestion, new_status, *, actor=None, description="", request=None):
    old = suggestion.status
    if old == new_status:
        return
    suggestion.status = new_status
    if new_status == SuggestionStatus.COMPLETED:
        suggestion.completed_at = timezone.now()
    suggestion.save(update_fields=["status", "completed_at", "updated_at"])
    record_event(
        suggestion,
        description or f"Status: {suggestion.get_status_display()}",
        actor=actor,
        from_status=old,
        to_status=new_status,
    )
    if request is not None:
        record_audit(
            request,
            "crm.suggestion.status",
            new_value={"suggestion": suggestion.id, "status": new_status},
        )


def snooze(suggestion, days, *, actor=None, request=None):
    suggestion.snoozed_until = timezone.localdate() + timedelta(days=max(1, days))
    suggestion.status = SuggestionStatus.SNOOZED
    suggestion.save(update_fields=["snoozed_until", "status", "updated_at"])
    record_event(
        suggestion,
        f"Adiada para {suggestion.snoozed_until.strftime('%d/%m/%Y')}.",
        actor=actor,
        to_status=SuggestionStatus.SNOOZED,
    )
    if request is not None:
        record_audit(
            request, "crm.suggestion.snoozed", new_value={"suggestion": suggestion.id}
        )


def to_task(suggestion, *, actor, title="", due_date=None, request=None):
    task = CrmTask.objects.create(
        title=title or suggestion.recommended_action,
        customer=suggestion.customer,
        vehicle=suggestion.vehicle,
        work_order=suggestion.work_order,
        quote=suggestion.quote,
        suggestion=suggestion,
        assigned_to=suggestion.assigned_to,
        due_date=due_date or suggestion.due_date,
        priority=suggestion.priority,
        status=TaskStatus.OPEN,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_event(suggestion, f"Tarefa criada: {task.title}.", actor=actor)
    if request is not None:
        record_audit(
            request,
            "crm.task.created",
            new_value={"task": task.id, "suggestion": suggestion.id},
        )
    return task


def to_campaign(suggestion, *, actor, name="", segment_key="", request=None):
    campaign = CrmCampaign.objects.create(
        name=name or f"Campanha: {suggestion.get_suggestion_type_display()}",
        segment_key=segment_key,
        channel=suggestion.channel,
        message=suggestion.suggested_text,
        status=CampaignStatus.DRAFT,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    record_event(
        suggestion, f"Convertida em campanha (rascunho): {campaign.name}.", actor=actor
    )
    if request is not None:
        record_audit(
            request,
            "crm.campaign.created",
            new_value={"campaign": campaign.id, "suggestion": suggestion.id},
        )
    return campaign
