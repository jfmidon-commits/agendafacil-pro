"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - TRIAL MANAGER (Cloud Function)

  Executa diariamente para:
  - Verificar trials expirados
  - Fazer downgrade automático para Free
  - Notificar usuários

  DEPLOY:
  gcloud functions deploy trial_manager --runtime python311 \
    --trigger-http --allow-unauthenticated

  AGENDAMENTO (Cloud Scheduler):
  gcloud scheduler jobs create http trial-check \
    --schedule="0 9 * * *" \
    --uri="https://sua-funcao.cloudfunctions.net/trial_manager" \
    --http-method=POST
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timezone, timedelta
import requests

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# Configurações
WHATSAPP_API_URL = "https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text"
MAKE_WEBHOOK_URL = "https://hook.make.com/SEU_WEBHOOK_TRIAL"


def trial_manager(request):
    """Verifica e processa trials expirados."""

    if request.method != 'POST':
        return ('Method not allowed', 405)

    try:
        now = datetime.now(timezone.utc)
        results = {
            'expired_today': 0,
            'expires_in_4_days': 0,
            'expires_in_1_day': 0,
            'downgraded': 0
        }

        # ─── 1. TRIALS QUE EXPIRAM HOJE ───
        expired = db.collection('users')\
            .where('trialStatus', '==', 'active')\
            .where('trialEndsAt', '<', now)\
            .get()

        for user_doc in expired:
            user = user_doc.to_dict()
            user_id = user_doc.id

            # Downgrade para Free
            db.collection('users').document(user_id).update({
                'plan': 'free',
                'trialStatus': 'ended',
                'subscriptionStatus': 'none',
                'updatedAt': now
            })

            # Notificar usuário
            notify_trial_ended(user)

            results['expired_today'] += 1
            results['downgraded'] += 1

        # ─── 2. TRIALS QUE EXPIRAM EM 4 DIAS ───
        day_4 = now + timedelta(days=4)
        day_4_start = day_4.replace(hour=0, minute=0, second=0, microsecond=0)
        day_4_end = day_4.replace(hour=23, minute=59, second=59, microsecond=0)

        expires_4d = db.collection('users')\
            .where('trialStatus', '==', 'active')\
            .where('trialEndsAt', '>=', day_4_start)\
            .where('trialEndsAt', '<=', day_4_end)\
            .get()

        for user_doc in expires_4d:
            user = user_doc.to_dict()
            notify_trial_expiring_soon(user, days=4)
            results['expires_in_4_days'] += 1

        # ─── 3. TRIALS QUE EXPIRAM AMANHÃ ───
        day_1 = now + timedelta(days=1)
        day_1_start = day_1.replace(hour=0, minute=0, second=0, microsecond=0)
        day_1_end = day_1.replace(hour=23, minute=59, second=59, microsecond=0)

        expires_1d = db.collection('users')\
            .where('trialStatus', '==', 'active')\
            .where('trialEndsAt', '>=', day_1_start)\
            .where('trialEndsAt', '<=', day_1_end)\
            .get()

        for user_doc in expires_1d:
            user = user_doc.to_dict()
            notify_trial_expiring_soon(user, days=1)
            results['expires_in_1_day'] += 1

        print(f"✅ Trial check completed: {results}")
        return (json.dumps(results), 200)

    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return (str(e), 500)


def notify_trial_ended(user):
    """Notifica usuário que o trial acabou."""
    message = f"""⏰ *Seu trial do AgendaFácil Pro acabou*\n\nOlá {user['name']}!\n\nSeu período de testes gratuito de 14 dias encerrou.\n\nPara continuar usando todos os recursos:\n✅ Agendamentos ilimitados\n✅ Confirmação automática por WhatsApp\n✅ Lembretes automáticos\n\n👉 Assine o Pro por apenas R$ 39/mês:\nagendafacil.pro/upgrade\n\nOu continue com o plano Free (10 agendamentos/mês)."""

    send_whatsapp(user['phone'], message)


def notify_trial_expiring_soon(user, days):
    """Notifica que o trial está acabando."""
    message = f"""⏰ *Seu trial acaba em {days} dia{'s' if days > 1 else ''}*\n\nOlá {user['name']}!\n\nSeu período de testes gratuito do AgendaFácil Pro termina em {days} dia{'s' if days > 1 else ''}.\n\nNão perca os benefícios! Assine agora e ganhe 20% OFF no primeiro mês:\n\n👉 agendafacil.pro/upgrade?discount=TRIAL20\n\nUse o cupom: TRIAL20"""

    send_whatsapp(user['phone'], message)


def send_whatsapp(phone, message):
    """Envia mensagem via WhatsApp API."""
    try:
        requests.post(WHATSAPP_API_URL, json={
            "phone": phone,
            "message": message
        }, timeout=10)
    except:
        pass  # Silencioso em caso de erro


import json
