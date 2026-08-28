"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - MOTOR DE DISPONIBILIDADE

  Calcula slots disponíveis considerando:
  - Regras de disponibilidade (availabilityRules)
  - Bloqueios específicos (scheduleBlocks)
  - Agendamentos existentes
  - Duração do serviço + buffers

  FUNÇÕES:
  - get_available_slots(user_id, date, service_id)
  - check_availability(user_id, starts_at, ends_at)
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timedelta, timezone

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()


def get_available_slots(user_id, target_date, service_id):
    """
    Retorna lista de slots disponíveis para um dia específico.

    Args:
        user_id: ID do profissional
        target_date: datetime.date ou string 'YYYY-MM-DD'
        service_id: ID do serviço

    Returns:
        list: [{'time': '09:00', 'available': True}, ...]
    """

    # Parse da data
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    day_of_week = target_date.weekday()  # 0=Seg, 6=Dom
    date_str = target_date.strftime('%Y-%m-%d')

    # ─── BUSCAR SERVIÇO ───
    service_doc = db.collection('services').document(service_id).get()
    if not service_doc.exists:
        return {'error': 'Serviço não encontrado'}

    service = service_doc.to_dict()
    service_duration = service['duration']
    buffer_before = service.get('bufferBefore', 0)
    buffer_after = service.get('bufferAfter', 0)
    total_duration = service_duration + buffer_before + buffer_after

    # ─── BUSCAR REGRA DE DISPONIBILIDADE ───
    rules = db.collection('availabilityRules')\
        .where('userId', '==', user_id)\
        .where('dayOfWeek', '==', day_of_week)\
        .where('isAvailable', '==', True)\
        .get()

    if not rules:
        return []  # Dia não disponível

    rule = list(rules)[0].to_dict()
    start_time = datetime.strptime(rule['startTime'], '%H:%M').time()
    end_time = datetime.strptime(rule['endTime'], '%H:%M').time()
    slot_duration = rule.get('slotDuration', 30)

    # ─── BUSCAR BLOQUEIOS DO DIA ───
    day_start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    blocks = db.collection('scheduleBlocks')\
        .where('userId', '==', user_id)\
        .where('startAt', '>=', day_start)\
        .where('startAt', '<', day_end)\
        .get()

    block_ranges = []
    for block in blocks:
        b = block.to_dict()
        block_ranges.append((b['startAt'], b['endAt']))

    # ─── BUSCAR AGENDAMENTOS DO DIA ───
    appointments = db.collection('appointments')\
        .where('userId', '==', user_id)\
        .where('status', 'in', ['confirmed', 'completed'])\
        .get()

    appt_ranges = []
    for appt in appointments:
        a = appt.to_dict()
        appt_date = a['startsAt'].astimezone(timezone.utc).date()
        if appt_date == target_date:
            total_start = a['startsAt'] - timedelta(minutes=a.get('bufferBefore', 0))
            total_end = a['endsAt'] + timedelta(minutes=a.get('bufferAfter', 0))
            appt_ranges.append((total_start, total_end))

    # ─── GERAR SLOTS ───
    slots = []
    current = datetime.combine(target_date, start_time).replace(tzinfo=timezone.utc)
    end = datetime.combine(target_date, end_time).replace(tzinfo=timezone.utc)

    while current + timedelta(minutes=total_duration) <= end:
        slot_start = current
        slot_end = current + timedelta(minutes=total_duration)

        # Verificar se conflita com bloqueios
        is_available = True
        for block_start, block_end in block_ranges:
            if slot_start < block_end and slot_end > block_start:
                is_available = False
                break

        # Verificar se conflita com agendamentos
        if is_available:
            for appt_start, appt_end in appt_ranges:
                if slot_start < appt_end and slot_end > appt_start:
                    is_available = False
                    break

        slots.append({
            'time': current.strftime('%H:%M'),
            'available': is_available,
            'duration': service_duration,
            'totalDuration': total_duration
        })

        current += timedelta(minutes=slot_duration)

    return slots


def check_availability(user_id, starts_at, ends_at):
    """
    Verifica se um intervalo específico está disponível.
    Usado internamente pela API /api/book.

    Returns:
        dict: {'available': True} ou {'available': False, 'reason': '...'}
    """

    # Buscar agendamentos existentes
    appointments = db.collection('appointments')\
        .where('userId', '==', user_id)\
        .where('status', 'in', ['confirmed', 'completed'])\
        .get()

    for appt in appointments:
        a = appt.to_dict()
        total_start = a['startsAt'] - timedelta(minutes=a.get('bufferBefore', 0))
        total_end = a['endsAt'] + timedelta(minutes=a.get('bufferAfter', 0))

        if starts_at < total_end and ends_at > total_start:
            return {'available': False, 'reason': 'Conflito com agendamento existente'}

    # Buscar bloqueios
    blocks = db.collection('scheduleBlocks')\
        .where('userId', '==', user_id)\
        .get()

    for block in blocks:
        b = block.to_dict()
        if starts_at < b['endAt'] and ends_at > b['startAt']:
            return {'available': False, 'reason': f'Bloqueado: {b.get("reason", "Indisponível")}'}

    return {'available': True}


# Exemplo de uso
if __name__ == '__main__':
    # Teste: listar slots para amanhã
    from datetime import date
    tomorrow = date.today() + timedelta(days=1)

    slots = get_available_slots(
        'demo-profissional-001',
        tomorrow,
        'service-001'
    )

    print(f"Slots disponíveis para {tomorrow}:")
    for slot in slots[:10]:
        status = "✅" if slot['available'] else "❌"
        print(f"  {status} {slot['time']} ({slot['duration']}min + buffers)")
