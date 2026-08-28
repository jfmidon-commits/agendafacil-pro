"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - API /api/book (Cloud Function)

  Endpoint seguro para criação de agendamentos com:
  - Validação de disponibilidade
  - Cálculo de buffers
  - Operação atômica (transação)
  - Prevenção de dupla reserva

  DEPLOY:
  1. Salvar como main.py
  2. Deploy: gcloud functions deploy api_book --runtime python311 --trigger-http --allow-unauthenticated
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime, timedelta, timezone
import os

# Inicializar Firebase (no Cloud Functions usa Application Default Credentials)
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

def api_book(request):
    """Cloud Function HTTP para criar agendamentos de forma segura."""

    # CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        return ('', 204, headers)

    if request.method != 'POST':
        return json_response({'error': 'Método não permitido'}, 405)

    try:
        data = request.get_json()

        # ─── VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS ───
        required = ['userId', 'serviceId', 'clientName', 'clientPhone', 'startsAt']
        missing = [f for f in required if f not in data or not data[f]]
        if missing:
            return json_response({'error': f'Campos obrigatórios: {missing}'}, 400)

        user_id = data['userId']
        service_id = data['serviceId']
        starts_at_str = data['startsAt']

        # ─── PARSE DO startsAt ───
        try:
            starts_at = datetime.fromisoformat(starts_at_str.replace('Z', '+00:00'))
            if starts_at.tzinfo is None:
                starts_at = starts_at.replace(tzinfo=timezone.utc)
        except:
            return json_response({'error': 'Formato inválido para startsAt. Use ISO 8601 (ex: 2026-08-29T14:00:00-03:00)'}, 400)

        # ─── BUSCAR SERVIÇO ───
        service_doc = db.collection('services').document(service_id).get()
        if not service_doc.exists:
            return json_response({'error': 'Serviço não encontrado'}, 404)

        service = service_doc.to_dict()
        if service['userId'] != user_id:
            return json_response({'error': 'Serviço não pertence a este profissional'}, 403)

        if not service.get('active', True):
            return json_response({'error': 'Serviço está inativo'}, 400)

        # ─── CALCULAR DURAÇÃO TOTAL ───
        service_duration = service['duration']
        buffer_before = service.get('bufferBefore', 0)
        buffer_after = service.get('bufferAfter', 0)
        total_duration = service_duration + buffer_before + buffer_after

        ends_at = starts_at + timedelta(minutes=service_duration)
        total_start = starts_at - timedelta(minutes=buffer_before)
        total_end = ends_at + timedelta(minutes=buffer_after)

        # ─── VERIFICAR DISPONIBILIDADE (TRANSAÇÃO ATÔMICA) ───
        @firestore.transactional
        def check_and_create(transaction, user_id, total_start, total_end):
            # Buscar agendamentos existentes que possam conflitar
            existing = db.collection('appointments')\
                .where('userId', '==', user_id)\
                .where('status', 'in', ['confirmed', 'completed'])\
                .get(transaction=transaction)

            for appt in existing:
                appt_data = appt.to_dict()
                appt_start = appt_data['startsAt']
                appt_end = appt_data['endsAt']

                # Verificar overlap
                if total_start < appt_end and total_end > appt_start:
                    return {'error': 'Horário indisponível (conflito com outro agendamento)'}

            # Buscar scheduleBlocks
            blocks = db.collection('scheduleBlocks')\
                .where('userId', '==', user_id)\
                .get(transaction=transaction)

            for block in blocks:
                block_data = block.to_dict()
                block_start = block_data['startAt']
                block_end = block_data['endAt']

                if total_start < block_end and total_end > block_start:
                    return {'error': f'Horário indisponível (bloqueado: {block_data.get("reason", "Indisponível")})'}

            # Criar o agendamento
            appointment_data = {
                'userId': user_id,
                'serviceId': service_id,
                'serviceName': service['name'],
                'serviceDuration': service_duration,
                'bufferBefore': buffer_before,
                'bufferAfter': buffer_after,
                'totalDuration': total_duration,
                'clientName': data['clientName'],
                'clientPhone': data['clientPhone'],
                'clientEmail': data.get('clientEmail', ''),
                'startsAt': starts_at,
                'endsAt': ends_at,
                'timezone': data.get('timezone', 'America/Sao_Paulo'),
                'status': 'confirmed',
                'notes': data.get('notes', ''),
                'reminderSent': False,
                'cancelledAt': None,
                'cancelledBy': None,
                'createdAt': datetime.now(timezone.utc)
            }

            new_ref = db.collection('appointments').document()
            transaction.set(new_ref, appointment_data)

            return {
                'success': True,
                'appointmentId': new_ref.id,
                'message': 'Agendamento confirmado!'
            }

        transaction = db.transaction()
        result = check_and_create(transaction, user_id, total_start, total_end)

        if 'error' in result:
            return json_response(result, 409)

        return json_response(result, 201)

    except Exception as e:
        return json_response({'error': str(e)}, 500)


def json_response(data, status_code=200):
    """Helper para retornar JSON com CORS."""
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    return (json.dumps(data, default=str), status_code, headers)
