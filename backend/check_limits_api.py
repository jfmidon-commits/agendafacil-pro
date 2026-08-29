"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - LIMIT CHECKER API

  Endpoint para verificar limites do plano antes de permitir ações.

  GET /api/check-limits?userId={uid}

  DEPLOY:
  gcloud functions deploy check_limits --runtime python311 \
    --trigger-http --allow-unauthenticated
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timezone
import json

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

LIMITS = {
    'free': {'appointments_per_month': 10, 'whatsapp': False, 'multiple_staff': False},
    'pro': {'appointments_per_month': float('inf'), 'whatsapp': True, 'multiple_staff': False},
    'studio': {'appointments_per_month': float('inf'), 'whatsapp': True, 'multiple_staff': True}
}


def check_limits(request):
    """Verifica os limites do plano do usuário."""

    # CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        return ('', 204, headers)

    if request.method != 'GET':
        return json_response({'error': 'Método não permitido'}, 405)

    try:
        user_id = request.args.get('userId')
        if not user_id:
            return json_response({'error': 'userId obrigatório'}, 400)

        # Buscar usuário
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return json_response({'error': 'Usuário não encontrado'}, 404)

        user = user_doc.to_dict()
        plan = user.get('plan', 'free')
        trial_status = user.get('trialStatus', 'never')
        trial_ends = user.get('trialEndsAt')

        # Verificar trial ativo
        trial_active = False
        trial_days_left = 0
        effective_plan = plan

        if trial_status == 'active' and trial_ends:
            trial_end = trial_ends
            if hasattr(trial_end, 'replace'):
                trial_end = trial_end.replace(tzinfo=timezone.utc)

            if trial_end > datetime.now(timezone.utc):
                trial_active = True
                trial_days_left = (trial_end - datetime.now(timezone.utc)).days
                effective_plan = 'pro'  # Trial = Pro

        # Buscar subscription ativa
        sub_docs = db.collection('subscriptions')\
            .where('userId', '==', user_id)\
            .where('status', '==', 'active')\
            .get()

        has_active_subscription = len(list(sub_docs)) > 0

        # Se tem subscription ativa, usar o plano da subscription
        if has_active_subscription:
            effective_plan = plan  # Já é o plano correto
        elif not trial_active and plan != 'free':
            # Plano expirou, reverter para free
            effective_plan = 'free'
            db.collection('users').document(user_id).update({
                'plan': 'free',
                'updatedAt': datetime.now(timezone.utc)
            })

        # Contar agendamentos do mês
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        appointments = db.collection('appointments')\
            .where('userId', '==', user_id)\
            .where('createdAt', '>=', month_start)\
            .where('status', 'in', ['confirmed', 'completed'])\
            .get()

        used = len(list(appointments))
        limit = LIMITS[effective_plan]['appointments_per_month']
        remaining = limit - used if limit != float('inf') else float('inf')

        # Verificar se pode criar novo agendamento
        can_create = remaining > 0 or limit == float('inf')

        return json_response({
            'userId': user_id,
            'plan': plan,
            'effectivePlan': effective_plan,
            'trialActive': trial_active,
            'trialDaysLeft': max(0, trial_days_left),
            'hasActiveSubscription': has_active_subscription,
            'limits': {
                'appointmentsPerMonth': limit if limit != float('inf') else -1,
                'usedThisMonth': used,
                'remaining': remaining if remaining != float('inf') else -1,
                'canCreateAppointment': can_create,
                'whatsappEnabled': LIMITS[effective_plan]['whatsapp'],
                'multipleStaffEnabled': LIMITS[effective_plan]['multiple_staff']
            },
            'upgradeMessage': None if can_create else 
                'Limite de 10 agendamentos/mês atingido. Faça upgrade para Pro!'
        })

    except Exception as e:
        return json_response({'error': str(e)}, 500)


def json_response(data, status_code=200):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    return (json.dumps(data, default=str), status_code, headers)
