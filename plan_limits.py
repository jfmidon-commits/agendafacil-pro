"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - VERIFICADOR DE LIMITES DE PLANO

  Verifica se o usuário pode criar novos agendamentos
  baseado no plano e no uso atual.

  LIMITES:
  - Free: 10 agendamentos/mês
  - Pro: Ilimitado
  - Studio: Ilimitado + múltiplos profissionais
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timezone

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

LIMITS = {
    'free': 10,
    'pro': float('inf'),
    'studio': float('inf')
}


def check_plan_limits(user_id):
    """
    Verifica se o usuário pode criar um novo agendamento.

    Returns:
        dict: {
            'allowed': True/False,
            'plan': 'free'|'pro'|'studio',
            'used': int,
            'limit': int,
            'remaining': int,
            'message': str
        }
    """

    # Buscar usuário
    user_doc = db.collection('users').document(user_id).get()
    if not user_doc.exists:
        return {'allowed': False, 'message': 'Usuário não encontrado'}

    user = user_doc.to_dict()
    plan = user.get('plan', 'free')
    trial_status = user.get('trialStatus', 'never')
    trial_ends = user.get('trialEndsAt')

    # Verificar trial ativo
    if trial_status == 'active' and trial_ends:
        if trial_ends.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            # Trial ativo = tratado como Pro
            plan = 'pro'

    # Se Pro ou Studio, sempre permitir
    if plan in ['pro', 'studio']:
        return {
            'allowed': True,
            'plan': plan,
            'used': 0,
            'limit': float('inf'),
            'remaining': float('inf'),
            'message': 'Plano ilimitado'
        }

    # Free: contar agendamentos do mês atual
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    appointments = db.collection('appointments')\
        .where('userId', '==', user_id)\
        .where('createdAt', '>=', month_start)\
        .where('status', 'in', ['confirmed', 'completed'])\
        .get()

    used = len(list(appointments))
    limit = LIMITS['free']
    remaining = limit - used

    if remaining > 0:
        return {
            'allowed': True,
            'plan': 'free',
            'used': used,
            'limit': limit,
            'remaining': remaining,
            'message': f'{remaining} agendamentos restantes este mês'
        }
    else:
        return {
            'allowed': False,
            'plan': 'free',
            'used': used,
            'limit': limit,
            'remaining': 0,
            'message': 'Limite de 10 agendamentos/mês atingido. Faça upgrade para Pro!'
        }


def get_plan_status(user_id):
    """
    Retorna o status completo do plano do usuário.
    """
    user_doc = db.collection('users').document(user_id).get()
    if not user_doc.exists:
        return {'error': 'Usuário não encontrado'}

    user = user_doc.to_dict()

    # Verificar trial
    trial_active = False
    trial_days_left = 0
    if user.get('trialStatus') == 'active' and user.get('trialEndsAt'):
        trial_end = user['trialEndsAt'].replace(tzinfo=timezone.utc)
        if trial_end > datetime.now(timezone.utc):
            trial_active = True
            trial_days_left = (trial_end - datetime.now(timezone.utc)).days

    # Buscar subscription ativa
    sub_docs = db.collection('subscriptions')\
        .where('userId', '==', user_id)\
        .where('status', '==', 'active')\
        .get()

    subscription = None
    for sub in sub_docs:
        subscription = sub.to_dict()
        subscription['id'] = sub.id
        break

    return {
        'plan': user.get('plan', 'free'),
        'trialActive': trial_active,
        'trialDaysLeft': max(0, trial_days_left),
        'trialStatus': user.get('trialStatus', 'never'),
        'subscriptionStatus': user.get('subscriptionStatus', 'none'),
        'subscription': subscription,
        'effectivePlan': 'pro' if trial_active else user.get('plan', 'free')
    }
