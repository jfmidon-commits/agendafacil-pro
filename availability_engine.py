"""AgendaFácil Pro availability engine.

Calculates available slots and validates booking windows using the repository's
root-level Firestore collections: services, availabilityRules, scheduleBlocks
and appointments.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

import firebase_admin
from firebase_admin import firestore

LOCAL_TZ = ZoneInfo("America/Sao_Paulo")


class SlotUnavailableException(Exception):
    """Raised when a requested slot cannot be booked."""


def _get_default_db():
    """Create the production Firestore client lazily, never during test import."""
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()


def _to_aware_datetime(value: Any, tz: ZoneInfo = LOCAL_TZ) -> datetime:
    """Normalize ISO strings/Firestore timestamps/datetimes to an aware local datetime.

    Naive datetimes are interpreted as UTC because Firestore timestamps and the
    public API are persisted as instants. Local wall-clock input should include
    an offset explicitly.
    """
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    elif hasattr(value, "to_datetime"):
        parsed = value.to_datetime()
    elif isinstance(value, datetime):
        parsed = value
    else:
        raise ValueError(f"Formato de data inválido: {type(value)!r}")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(tz)


def _firestore_instant(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(timezone.utc)


def _schema_day_of_week(local_date: date) -> int:
    """Return schema dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday."""
    return (local_date.weekday() + 1) % 7


def _overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Return True when semi-open intervals [start, end) overlap."""
    return max(start_a, start_b) < min(end_a, end_b)


def _query_docs(query: Any, transaction: Any = None) -> Iterable[Any]:
    return query.get(transaction=transaction) if transaction is not None else query.get()


def _day_rules(db_client: Any, user_id: str, local_date: date, transaction: Any = None) -> List[Dict[str, Any]]:
    query = (
        db_client.collection("availabilityRules")
        .where("userId", "==", user_id)
        .where("dayOfWeek", "==", _schema_day_of_week(local_date))
    )
    rules: List[Dict[str, Any]] = []
    for doc in _query_docs(query, transaction):
        payload = doc.to_dict() or {}
        if payload.get("isAvailable", False):
            rules.append(payload)
    return rules


def _rule_window(rule: Dict[str, Any], local_date: date, tz: ZoneInfo) -> Optional[Tuple[datetime, datetime]]:
    start_text = rule.get("startTime") or ""
    end_text = rule.get("endTime") or ""
    if not start_text or not end_text:
        return None
    try:
        start_t = datetime.strptime(start_text, "%H:%M").time()
        end_t = datetime.strptime(end_text, "%H:%M").time()
    except ValueError:
        return None
    start_dt = datetime.combine(local_date, start_t, tzinfo=tz)
    end_dt = datetime.combine(local_date, end_t, tzinfo=tz)
    if end_dt <= start_dt:
        return None
    return start_dt, end_dt


def _fits_any_rule(required_start: datetime, required_end: datetime, rules: List[Dict[str, Any]], tz: ZoneInfo) -> bool:
    local_date = required_start.astimezone(tz).date()
    for rule in rules:
        window = _rule_window(rule, local_date, tz)
        if not window:
            continue
        work_start, work_end = window
        if required_start >= work_start and required_end <= work_end:
            return True
    return False


def _candidate_window(local_date: date, tz: ZoneInfo) -> Tuple[datetime, datetime]:
    """Bound reads while covering blocks/appointments that started across midnight."""
    day_start = datetime.combine(local_date, time.min, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    return day_start - timedelta(days=1), day_end + timedelta(days=1)


def _load_schedule_blocks(db_client: Any, user_id: str, local_date: date, transaction: Any = None, tz: ZoneInfo = LOCAL_TZ) -> List[Dict[str, Any]]:
    query_start, query_end = _candidate_window(local_date, tz)
    query = (
        db_client.collection("scheduleBlocks")
        .where("userId", "==", user_id)
        .where("startAt", ">=", _firestore_instant(query_start))
        .where("startAt", "<", _firestore_instant(query_end))
    )
    result: List[Dict[str, Any]] = []
    for doc in _query_docs(query, transaction):
        payload = doc.to_dict() or {}
        payload.setdefault("id", getattr(doc, "id", ""))
        result.append(payload)
    return result


def _load_appointments(db_client: Any, user_id: str, local_date: date, transaction: Any = None, tz: ZoneInfo = LOCAL_TZ) -> List[Dict[str, Any]]:
    query_start, query_end = _candidate_window(local_date, tz)
    query = (
        db_client.collection("appointments")
        .where("userId", "==", user_id)
        .where("startsAt", ">=", _firestore_instant(query_start))
        .where("startsAt", "<", _firestore_instant(query_end))
    )
    result: List[Dict[str, Any]] = []
    for doc in _query_docs(query, transaction):
        payload = doc.to_dict() or {}
        payload.setdefault("id", getattr(doc, "id", ""))
        result.append(payload)
    return result


def check_availability_in_memory(
    starts_at: datetime,
    ends_at: datetime,
    service_buffer_before: int,
    service_buffer_after: int,
    availability_rules: List[Dict[str, Any]],
    schedule_blocks: List[Dict[str, Any]],
    existing_appointments: List[Dict[str, Any]],
    tz: ZoneInfo = LOCAL_TZ,
) -> Tuple[bool, str]:
    """Pure availability validation used by Firestore and unit tests."""
    starts_local = _to_aware_datetime(starts_at, tz)
    ends_local = _to_aware_datetime(ends_at, tz)
    if starts_local >= ends_local:
        return False, "INVALID_INTERVAL"

    required_start = starts_local - timedelta(minutes=max(0, int(service_buffer_before or 0)))
    required_end = ends_local + timedelta(minutes=max(0, int(service_buffer_after or 0)))
    if not _fits_any_rule(required_start, required_end, availability_rules, tz):
        return False, "OUTSIDE_WORKING_HOURS"

    for block in schedule_blocks:
        try:
            block_start = _to_aware_datetime(block["startAt"], tz)
            block_end = _to_aware_datetime(block["endAt"], tz)
        except (KeyError, ValueError, TypeError):
            continue
        if _overlaps(required_start, required_end, block_start, block_end):
            return False, "SCHEDULE_BLOCK_CONFLICT"

    for appointment in existing_appointments:
        if appointment.get("status") == "cancelled":
            continue
        try:
            appt_start = _to_aware_datetime(appointment["startsAt"], tz)
            appt_end = _to_aware_datetime(appointment["endsAt"], tz)
        except (KeyError, ValueError, TypeError):
            continue
        appt_before = max(0, int(appointment.get("bufferBefore", 0) or 0))
        appt_after = max(0, int(appointment.get("bufferAfter", 0) or 0))
        occupied_start = appt_start - timedelta(minutes=appt_before)
        occupied_end = appt_end + timedelta(minutes=appt_after)
        if _overlaps(required_start, required_end, occupied_start, occupied_end):
            return False, "APPOINTMENT_CONFLICT"
    return True, "AVAILABLE"


def check_availability(
    user_id: str,
    starts_at: Any,
    ends_at: Any,
    service_id: Optional[str] = None,
    *,
    db_client: Any = None,
    transaction: Any = None,
    timezone_name: str = "America/Sao_Paulo",
) -> Dict[str, Any]:
    """Check whether a booking interval is available.

    Backwards-compatible return shape: {'available': bool, 'reason': str?}.
    """
    client = db_client or _get_default_db()
    tz = ZoneInfo(timezone_name)
    try:
        starts_local = _to_aware_datetime(starts_at, tz)
        ends_local = _to_aware_datetime(ends_at, tz)
    except (ValueError, TypeError) as exc:
        return {"available": False, "reason": f"INVALID_DATETIME: {exc}"}
    if starts_local >= ends_local:
        return {"available": False, "reason": "INVALID_INTERVAL"}

    before = after = 0
    if service_id:
        service_ref = client.collection("services").document(service_id)
        service_doc = service_ref.get(transaction=transaction) if transaction is not None else service_ref.get()
        if not service_doc.exists:
            return {"available": False, "reason": "SERVICE_NOT_FOUND"}
        service = service_doc.to_dict() or {}
        if service.get("userId") != user_id:
            return {"available": False, "reason": "SERVICE_FORBIDDEN"}
        if not service.get("active", True):
            return {"available": False, "reason": "SERVICE_INACTIVE"}
        before = service.get("bufferBefore", 0) or 0
        after = service.get("bufferAfter", 0) or 0

    local_date = starts_local.date()
    rules = _day_rules(client, user_id, local_date, transaction)
    blocks = _load_schedule_blocks(client, user_id, local_date, transaction, tz)
    appointments = _load_appointments(client, user_id, local_date, transaction, tz)
    available, reason = check_availability_in_memory(
        starts_local, ends_local, before, after, rules, blocks, appointments, tz
    )
    return {"available": True} if available else {"available": False, "reason": reason}


def get_available_slots(
    user_id: str,
    target_date: Any,
    service_id: str,
    *,
    db_client: Any = None,
    timezone_name: str = "America/Sao_Paulo",
) -> List[Dict[str, Any]]:
    """Return available service start times for one local calendar day."""
    client = db_client or _get_default_db()
    tz = ZoneInfo(timezone_name)
    if isinstance(target_date, str):
        local_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    elif isinstance(target_date, datetime):
        local_date = _to_aware_datetime(target_date, tz).date()
    elif isinstance(target_date, date):
        local_date = target_date
    else:
        raise ValueError("target_date deve ser date, datetime ou YYYY-MM-DD")

    service_doc = client.collection("services").document(service_id).get()
    if not service_doc.exists:
        return []
    service = service_doc.to_dict() or {}
    if service.get("userId") != user_id or not service.get("active", True):
        return []
    duration = int(service.get("duration", 0) or 0)
    if duration <= 0:
        return []
    buffer_before = int(service.get("bufferBefore", 0) or 0)
    buffer_after = int(service.get("bufferAfter", 0) or 0)

    rules = _day_rules(client, user_id, local_date)
    if not rules:
        return []
    blocks = _load_schedule_blocks(client, user_id, local_date, tz=tz)
    appointments = _load_appointments(client, user_id, local_date, tz=tz)

    slots: List[Dict[str, Any]] = []
    for rule in rules:
        window = _rule_window(rule, local_date, tz)
        if not window:
            continue
        work_start, work_end = window
        interval = int(rule.get("slotDuration", 30) or 30)
        if interval <= 0:
            interval = 30
        current = work_start
        while current + timedelta(minutes=duration) <= work_end:
            ends_at = current + timedelta(minutes=duration)
            available, _ = check_availability_in_memory(
                current, ends_at, buffer_before, buffer_after, rules, blocks, appointments, tz
            )
            if available:
                slots.append({
                    "time": current.strftime("%H:%M"),
                    "startsAt": current.isoformat(),
                    "endsAt": ends_at.isoformat(),
                    "available": True,
                    "duration": duration,
                    "totalDuration": duration + buffer_before + buffer_after,
                })
            current += timedelta(minutes=interval)
    slots.sort(key=lambda item: item["startsAt"])
    return slots


if __name__ == "__main__":
    from datetime import date as _date
    tomorrow = _date.today() + timedelta(days=1)
    for slot in get_available_slots("demo-profissional-001", tomorrow, "service-001")[:10]:
        print(slot)
