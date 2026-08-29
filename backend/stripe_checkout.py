"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - STRIPE CHECKOUT API

  Cria sessões de checkout para os planos.

  POST /api/create-checkout-session
  {
    "userId": "uid",
    "plan": "pro" | "pro-annual" | "studio"
  }

  DEPLOY:
  gcloud functions deploy create_checkout --runtime python311 \
    --trigger-http --allow-unauthenticated
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import firestore
import stripe
import json
import os

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# Configurar Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

# Mapeamento de planos para Price IDs do Stripe
# Substitua pelos seus Price IDs reais do Stripe Dashboard
PRICE_IDS = {
    'pro': 'price_PRO_MONTHLY_ID',
    'pro-annual': 'price_PRO_ANNUAL_ID',
    'studio': 'price_STUDIO_MONTHLY_ID'
}

SUCCESS_URL = 'https://agendafacil-pro.web.app/payment/success?session_id={CHECKOUT_SESSION_ID}'
CANCEL_URL = 'https://agendafacil-pro.web.app/payment/cancel'


def create_checkout(request):
    """Cria sessão de checkout do Stripe."""

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
        user_id = data.get('userId')
        plan = data.get('plan', 'pro')

        if not user_id:
            return json_response({'error': 'userId obrigatório'}, 400)

        if plan not in PRICE_IDS:
            return json_response({'error': f'Plano inválido: {plan}'}, 400)

        # Buscar usuário
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return json_response({'error': 'Usuário não encontrado'}, 404)

        user = user_doc.to_dict()

        # Criar ou buscar cliente Stripe
        customer_id = user.get('stripeCustomerId')
        if not customer_id:
            customer = stripe.Customer.create(
                email=user['email'],
                name=user['name'],
                phone=user.get('phone', ''),
                metadata={'userId': user_id}
            )
            customer_id = customer.id

            # Salvar customerId no usuário
            db.collection('users').document(user_id).update({
                'stripeCustomerId': customer_id
            })

        # Criar sessão de checkout
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': PRICE_IDS[plan],
                'quantity': 1,
            }],
            mode='subscription',
            success_url=SUCCESS_URL,
            cancel_url=CANCEL_URL,
            metadata={
                'userId': user_id,
                'plan': plan
            }
        )

        return json_response({
            'sessionId': session.id,
            'url': session.url
        })

    except Exception as e:
        return json_response({'error': str(e)}, 500)


def json_response(data, status_code=200):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    return (json.dumps(data, default=str), status_code, headers)
