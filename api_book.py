"""AgendaFácil Pro /api/book Cloud Function.

The HTTP contract remains compatible with the existing endpoint while the final
availability validation and appointment creation happen in one Firestore
transaction. A deterministic professional/day lock forces concurrent bookings
for the same professional/day to contend on the same document.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any, Dict

import firebase_admin
from firebase_admin import firestore

from availability_engine import LOCAL_TZ, _to_aware_datetime, check_availability


class SlotUnavailableException(Exception):
    """Requested slot is no longer available."""


class ServiceNotFoundException(Exception):
    pass


class ServiceForbiddenException(Exception):
    pass


class ServiceInactiveException(Exception):
    pass


class InvalidPayloadException(Exception):
    pass


def _get_default_db():
    """Create the production Firestore client lazily, never during test import."""
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


@firestore.transactional
def _book_transaction(
    transaction: Any,
    db_client: Any,
    user_id: str,
    service_id: str,
    starts_at: Any,
    request_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate and create one appointment atomically.

    All Firestore reads happen before the first write. The function has no
    external side effects, so Firestore may safely retry it on contention.
    """
    starts_local = _to_aware_datetime(starts_at, LOCAL_TZ)

    service_ref = db_client.collection("services").document(service_id)
    service_doc = service_ref.get(transaction=transaction)
    if not service_doc.exists:
        raise ServiceNotFoundException("Serviço não encontrado")

    service = service_doc.to_dict() or {}
    if service.get("userId") != user_id:
        raise ServiceForbiddenException("Serviço não pertence a este profissional")
    if not service.get("active", True):
        raise ServiceInactiveException("Serviço está inativo")

    try:
        service_duration = int(service.get("duration", 0))
        buffer_before = max(0, int(service.get("bufferBefore", 0) or 0))
        buffer_after = max(0, int(service.get("bufferAfter", 0) or 0))
    except (TypeError, ValueError) as exc:
        raise InvalidPayloadException("Configuração de serviço inválida") from exc
    if service_duration <= 0:
        raise InvalidPayloadException("Duração do serviço deve ser maior que zero")

    ends_local = starts_local + timedelta(minutes=service_duration)
    if starts_local >= ends_local:
        raise InvalidPayloadException("Horário inicial deve ser anterior ao final")

    date_key = starts_local.strftime("%Y%m%d")
    lock_ref = db_client.collection("bookingLocks").document(f"{user_id}_{date_key}")
    lock_doc = lock_ref.get(transaction=transaction)

    availability = check_availability(
        user_id,
        starts_local,
        ends_local,
        service_id,
        db_client=db_client,
        transaction=transaction,
        timezone_name="America/Sao_Paulo",
    )
    if not availability.get("available"):
        raise SlotUnavailableException(availability.get("reason", "Horário indisponível"))

    current_version = 0
    if lock_doc.exists:
        current_version = int((lock_doc.to_dict() or {}).get("version", 0) or 0)
    transaction.set(
        lock_ref,
        {
            "userId": user_id,
            "date": date_key,
            "lastBookingAt": firestore.SERVER_TIMESTAMP,
            "version": current_version + 1,
        },
        merge=True,
    )

    appointment_ref = db_client.collection("appointments").document()
    appointment_data = {
        "userId": user_id,
        "serviceId": service_id,
        "serviceName": service.get("name", ""),
        "serviceDuration": service_duration,
        "bufferBefore": buffer_before,
        "bufferAfter": buffer_after,
        "totalDuration": service_duration + buffer_before + buffer_after,
        "clientName": request_data["clientName"],
        "clientPhone": request_data["clientPhone"],
        "clientEmail": request_data.get("clientEmail", ""),
        "startsAt": starts_local,
        "endsAt": ends_local,
        "timezone": request_data.get("timezone", "America/Sao_Paulo"),
        "status": "confirmed",
        "notes": request_data.get("notes", ""),
        "reminderSent": False,
        "cancelledAt": None,
        "cancelledBy": None,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    transaction.set(appointment_ref, appointment_data)

    return {"appointmentId": appointment_ref.id, "appointment": appointment_data}


def create_booking_transactional(
    db_client: Any,
    user_id: str,
    service_id: str,
    starts_at: Any,
    request_data: Dict[str, Any],
) -> Dict[str, Any]:
    transaction = db_client.transaction()
    return _book_transaction(transaction, db_client, user_id, service_id, starts_at, request_data)


def api_book(request):
    """Cloud Function HTTP endpoint for secure appointment creation."""
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
        }
        return "", 204, headers

    if request.method != "POST":
        return json_response({"error": "Método não permitido"}, 405)

    try:
        data = request.get_json() or {}
        required = ["userId", "serviceId", "clientName", "clientPhone", "startsAt"]
        missing = [field for field in required if not data.get(field)]
        if missing:
            return json_response({"error": f"Campos obrigatórios: {missing}"}, 400)

        try:
            starts_at = _to_aware_datetime(data["startsAt"], LOCAL_TZ)
        except (ValueError, TypeError):
            return json_response(
                {"error": "Formato inválido para startsAt. Use ISO 8601 com timezone."},
                400,
            )

        result = create_booking_transactional(
            _get_default_db(),
            data["userId"],
            data["serviceId"],
            starts_at,
            data,
        )
        return json_response(
            {
                "success": True,
                "appointmentId": result["appointmentId"],
                "message": "Agendamento confirmado!",
            },
            201,
        )

    except InvalidPayloadException as exc:
        return json_response({"error": str(exc)}, 400)
    except ServiceInactiveException as exc:
        return json_response({"error": str(exc)}, 400)
    except ServiceForbiddenException as exc:
        return json_response({"error": str(exc)}, 403)
    except ServiceNotFoundException as exc:
        return json_response({"error": str(exc)}, 404)
    except SlotUnavailableException as exc:
        return json_response(
            {"error": "Horário indisponível", "code": "SLOT_UNAVAILABLE", "reason": str(exc)},
            409,
        )
    except Exception:
        return json_response({"error": "Erro interno ao processar agendamento."}, 500)


def json_response(data, status_code=200):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    }
    return json.dumps(data, default=str), status_code, headers
