from __future__ import annotations

import concurrent.futures
import threading
from datetime import datetime, timedelta

import pytest

from availability_engine import LOCAL_TZ, _to_aware_datetime, check_availability_in_memory
from api_book import (
    ServiceForbiddenException,
    ServiceInactiveException,
    SlotUnavailableException,
    _book_transaction_body,
)


RULES = [{"startTime": "08:00", "endTime": "18:00", "isAvailable": True, "slotDuration": 30}]


def dt(hour: int, minute: int = 0, day: int = 1):
    return datetime(2026, 9, day, hour, minute, tzinfo=LOCAL_TZ)


def validate(start, end, before=0, after=0, blocks=None, appointments=None, rules=None):
    return check_availability_in_memory(
        start,
        end,
        before,
        after,
        RULES if rules is None else rules,
        blocks or [],
        appointments or [],
    )


def test_01_slot_livre():
    assert validate(dt(9), dt(9, 30)) == (True, "AVAILABLE")


def test_02_conflito_exato():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "status": "confirmed"}]
    assert validate(dt(10), dt(11), appointments=appointments)[1] == "APPOINTMENT_CONFLICT"


def test_03_overlap_parcial_inicio():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "status": "confirmed"}]
    assert validate(dt(9, 30), dt(10, 30), appointments=appointments)[1] == "APPOINTMENT_CONFLICT"


def test_04_overlap_parcial_fim():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "status": "confirmed"}]
    assert validate(dt(10, 30), dt(11, 30), appointments=appointments)[1] == "APPOINTMENT_CONFLICT"


def test_05_horario_encostado_sem_overlap():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "status": "confirmed"}]
    assert validate(dt(11), dt(12), appointments=appointments)[0] is True


def test_06_buffer_before_colisao():
    appointments = [{"startsAt": dt(10, 30), "endsAt": dt(11), "bufferBefore": 15, "status": "confirmed"}]
    assert validate(dt(9, 50), dt(10, 20), appointments=appointments)[1] == "APPOINTMENT_CONFLICT"


def test_07_buffer_after_colisao():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "bufferAfter": 15, "status": "confirmed"}]
    assert validate(dt(11, 10), dt(11, 40), appointments=appointments)[1] == "APPOINTMENT_CONFLICT"


def test_08_schedule_block_dia_atual():
    blocks = [{"startAt": dt(14), "endAt": dt(15)}]
    assert validate(dt(14, 15), dt(14, 45), blocks=blocks)[1] == "SCHEDULE_BLOCK_CONFLICT"


def test_09_schedule_block_dia_anterior_intersecao():
    wide_rules = [{"startTime": "00:00", "endTime": "18:00", "isAvailable": True}]
    blocks = [{"startAt": datetime(2026, 8, 31, 23, 45, tzinfo=LOCAL_TZ), "endAt": dt(0, 15)}]
    assert validate(dt(0), dt(0, 30), blocks=blocks, rules=wide_rules)[1] == "SCHEDULE_BLOCK_CONFLICT"


def test_10_fora_do_horario_de_trabalho():
    assert validate(dt(7), dt(7, 30))[1] == "OUTSIDE_WORKING_HOURS"


def test_11_buffer_after_ultrapassa_expediente():
    assert validate(dt(17, 30), dt(18), after=15)[1] == "OUTSIDE_WORKING_HOURS"


def test_12_buffer_before_ultrapassa_expediente():
    assert validate(dt(8), dt(8, 30), before=15)[1] == "OUTSIDE_WORKING_HOURS"


def test_13_dia_sem_availability_rule():
    assert validate(dt(10), dt(10, 30), rules=[])[1] == "OUTSIDE_WORKING_HOURS"


def test_14_timezone_america_sao_paulo():
    local = _to_aware_datetime("2026-09-01T12:00:00Z")
    assert local.hour == 9
    assert getattr(local.tzinfo, "key", None) == "America/Sao_Paulo"


def test_15_servico_outro_profissional():
    db = FakeFirestore()
    seed_base(db, service_user="outro-user")
    tx = FakeTransaction(db)
    with pytest.raises(ServiceForbiddenException):
        _book_transaction_body(tx, db, "user-1", "service-1", dt(10), payload("A"))


def test_16_servico_inativo():
    db = FakeFirestore()
    seed_base(db, active=False)
    tx = FakeTransaction(db)
    with pytest.raises(ServiceInactiveException):
        _book_transaction_body(tx, db, "user-1", "service-1", dt(10), payload("A"))


def test_17_status_cancelled_nao_bloqueia():
    appointments = [{"startsAt": dt(10), "endsAt": dt(11), "status": "cancelled"}]
    assert validate(dt(10), dt(11), appointments=appointments)[0] is True


def test_18_concorrencia_simultanea_transactional_fake():
    db = FakeFirestore()
    seed_base(db)
    barrier = threading.Barrier(2)

    def worker(start, name):
        barrier.wait()
        return db.run_atomic(
            lambda tx: _book_transaction_body(tx, db, "user-1", "service-1", start, payload(name))
        )

    results = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(worker, dt(10), "A"), executor.submit(worker, dt(10, 15), "B")]
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except SlotUnavailableException as exc:
                errors.append(exc)

    assert len(results) == 1
    assert len(errors) == 1
    persisted = db.collection("appointments").get()
    assert len(persisted) == 1
    lock = db.collection("bookingLocks").document("user-1_20260901").get()
    assert lock.exists
    assert lock.to_dict()["version"] == 1


def payload(name):
    return {
        "clientName": f"Cliente {name}",
        "clientPhone": "51999999999",
        "clientEmail": f"{name.lower()}@example.com",
        "timezone": "America/Sao_Paulo",
    }


def seed_base(db, service_user="user-1", active=True):
    db.seed(
        "services",
        "service-1",
        {
            "userId": service_user,
            "name": "Corte",
            "duration": 30,
            "bufferBefore": 0,
            "bufferAfter": 0,
            "active": active,
        },
    )
    # 2026-09-01 is Tuesday; schema uses 0=Sunday, so Tuesday=2.
    db.seed(
        "availabilityRules",
        "rule-1",
        {
            "userId": "user-1",
            "dayOfWeek": 2,
            "startTime": "08:00",
            "endTime": "18:00",
            "isAvailable": True,
            "slotDuration": 30,
        },
    )


class FakeSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = None if data is None else dict(data)

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return None if self._data is None else dict(self._data)


class FakeDocumentRef:
    def __init__(self, db, collection_name, doc_id):
        self.db = db
        self.collection_name = collection_name
        self.id = doc_id

    def get(self, transaction=None):
        return FakeSnapshot(self.id, self.db._data.get(self.collection_name, {}).get(self.id))


class FakeQuery:
    def __init__(self, db, collection_name, filters=None):
        self.db = db
        self.collection_name = collection_name
        self.filters = list(filters or [])

    def where(self, field, op, value):
        return FakeQuery(self.db, self.collection_name, self.filters + [(field, op, value)])

    def get(self, transaction=None):
        result = []
        for doc_id, data in self.db._data.get(self.collection_name, {}).items():
            if all(self._matches(data.get(field), op, value) for field, op, value in self.filters):
                result.append(FakeSnapshot(doc_id, data))
        return result

    @staticmethod
    def _matches(actual, op, expected):
        if op == "==":
            return actual == expected
        if actual is None:
            return False
        if op == ">=":
            return actual >= expected
        if op == "<":
            return actual < expected
        raise AssertionError(f"unsupported fake query op: {op}")


class FakeCollection(FakeQuery):
    def __init__(self, db, collection_name):
        super().__init__(db, collection_name)

    def document(self, doc_id=None):
        if doc_id is None:
            self.db._sequence += 1
            doc_id = f"auto-{self.db._sequence}"
        return FakeDocumentRef(self.db, self.collection_name, doc_id)


class FakeTransaction:
    def __init__(self, db):
        self.db = db
        self.writes = []

    def set(self, ref, data, merge=False):
        self.writes.append((ref, dict(data), merge))

    def commit(self):
        for ref, data, merge in self.writes:
            current = dict(self.db._data.setdefault(ref.collection_name, {}).get(ref.id, {})) if merge else {}
            clean = {key: value for key, value in data.items() if key != "lastBookingAt" and key != "createdAt"}
            current.update(clean)
            self.db._data[ref.collection_name][ref.id] = current


class FakeFirestore:
    def __init__(self):
        self._data = {}
        self._sequence = 0
        self._mutex = threading.Lock()

    def collection(self, name):
        return FakeCollection(self, name)

    def transaction(self):
        return FakeTransaction(self)

    def seed(self, collection, doc_id, data):
        self._data.setdefault(collection, {})[doc_id] = dict(data)

    def run_atomic(self, callback):
        # Serializes the exact transaction body to model Firestore's serializable
        # commit semantics without production credentials.
        with self._mutex:
            tx = FakeTransaction(self)
            result = callback(tx)
            tx.commit()
            return result
