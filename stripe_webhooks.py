"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - STRIPE WEBHOOKS HANDLER

  Processa todos os eventos do Stripe:
  - checkout.session.completed → nova assinatura
  - invoice.payment_succeeded → renovação
  - invoice.payment_failed → falha de cobrança
  - customer.subscription.deleted → cancelamento
  - customer.subscription.updated → troca de plano

  DEPLOY:
  gcloud functions deploy stripe_webhooks --runtime python311 \
    --trigger-http --allow-unauthenticated
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
import json
import os
from datetime import datetime, timezone

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')


def stripe_webhooks(request):
    """Cloud Function para processar webhooks do Stripe."""

    if request.method != 'POST':
        return ('Method not allowed', 405)

    try:
        payload = request.get_data()
        event = json.loads(payload)
        event_type = event['type']

        print(f"📩 Stripe event: {event_type}")

        # ─── checkout.session.completed ───
        if event_type == 'checkout.session.completed':
            session = event['data']['object']
            customer_id = session['customer']
            subscription_id = session.get('subscription')
            metadata = session.get('metadata', {})
            user_id = metadata.get('userId')
            plan = metadata.get('plan', 'pro')

            if not user_id:
                return ('Missing userId in metadata', 400)

            # Criar/atualizar subscription
            sub_data = {
                'userId': user_id,
                'stripeCustomerId': customer_id,
                'stripeSubscriptionId': subscription_id,
                'plan': plan,
                'status': 'active',
                'currentPeriodStart': datetime.now(timezone.utc),
                'currentPeriodEnd': datetime.now(timezone.utc) + timedelta(days=30),
                'cancelAtPeriodEnd': False,
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            }

            db.collection('subscriptions').document(subscription_id).set(sub_data)

            # Atualizar usuário
            db.collection('users').document(user_id).update({
                'plan': plan,
                'subscriptionStatus': 'active',
                'trialStatus': 'ended',
                'stripeCustomerId': customer_id,
                'updatedAt': datetime.now(timezone.utc)
            })

            print(f"✅ Subscription criada: {subscription_id} para {user_id}")

        # ─── invoice.payment_succeeded ───
        elif event_type == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            subscription_id = invoice['subscription']

            sub_doc = db.collection('subscriptions').document(subscription_id).get()
            if sub_doc.exists:
                sub_data = sub_doc.to_dict()

                # Renovar período
                new_period_end = datetime.now(timezone.utc) + timedelta(days=30)

                db.collection('subscriptions').document(subscription_id).update({
                    'status': 'active',
                    'currentPeriodEnd': new_period_end,
                    'updatedAt': datetime.now(timezone.utc)
                })

                # Atualizar usuário
                db.collection('users').document(sub_data['userId']).update({
                    'subscriptionStatus': 'active',
                    'updatedAt': datetime.now(timezone.utc)
                })

                print(f"✅ Assinatura renovada: {subscription_id}")

        # ─── invoice.payment_failed ───
        elif event_type == 'invoice.payment_failed':
            invoice = event['data']['object']
            subscription_id = invoice['subscription']

            sub_doc = db.collection('subscriptions').document(subscription_id).get()
            if sub_doc.exists:
                sub_data = sub_doc.to_dict()

                db.collection('subscriptions').document(subscription_id).update({
                    'status': 'past_due',
                    'updatedAt': datetime.now(timezone.utc)
                })

                db.collection('users').document(sub_data['userId']).update({
                    'subscriptionStatus': 'past_due',
                    'updatedAt': datetime.now(timezone.utc)
                })

                # TODO: Enviar notificação por WhatsApp/e-mail
                print(f"⚠️ Falha de pagamento: {subscription_id}")

        # ─── customer.subscription.deleted ───
        elif event_type == 'customer.subscription.deleted':
            subscription = event['data']['object']
            subscription_id = subscription['id']

            sub_doc = db.collection('subscriptions').document(subscription_id).get()
            if sub_doc.exists:
                sub_data = sub_doc.to_dict()
                user_id = sub_data['userId']

                db.collection('subscriptions').document(subscription_id).update({
                    'status': 'cancelled',
                    'updatedAt': datetime.now(timezone.utc)
                })

                # Reverter para plano free
                db.collection('users').document(user_id).update({
                    'plan': 'free',
                    'subscriptionStatus': 'cancelled',
                    'updatedAt': datetime.now(timezone.utc)
                })

                print(f"✅ Assinatura cancelada: {subscription_id}")

        # ─── customer.subscription.updated ───
        elif event_type == 'customer.subscription.updated':
            subscription = event['data']['object']
            subscription_id = subscription['id']
            new_plan = subscription['plan']['id']  # ex: 'pro', 'studio'

            sub_doc = db.collection('subscriptions').document(subscription_id).get()
            if sub_doc.exists:
                sub_data = sub_doc.to_dict()
                user_id = sub_data['userId']

                db.collection('subscriptions').document(subscription_id).update({
                    'plan': new_plan,
                    'updatedAt': datetime.now(timezone.utc)
                })

                db.collection('users').document(user_id).update({
                    'plan': new_plan,
                    'updatedAt': datetime.now(timezone.utc)
                })

                print(f"✅ Plano alterado: {subscription_id} → {new_plan}")

        return ('OK', 200)

    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return (str(e), 500)
