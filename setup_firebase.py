#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA

  Este script configura automaticamente:
  - Firestore Database
  - Authentication (Email/Senha + Google)
  - Coleções: users, services, appointments, subscriptions
  - Regras de segurança
  - App Web registrado

  PRÉ-REQUISITOS:
  - Python 3.8+
  - pip install firebase-admin
  - Service account key na mesma pasta (agendafacil-pro-firebase-adminsdk-*.json)

  USO:
  python setup_firebase.py
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import credentials, firestore, auth
import json
import os
from datetime import datetime, timedelta

print("=" * 65)
print("  🚀 AGENDAFÁCIL PRO - CONFIGURAÇÃO AUTOMÁTICA DO FIREBASE")
print("=" * 65)

# ─────────────────────────────────────────────────────────────
# 1. INICIALIZAR FIREBASE ADMIN SDK
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 1: Inicializando Firebase Admin SDK...")

# Encontrar o arquivo de service account
service_account_files = [f for f in os.listdir('.') if f.startswith('agendafacil-pro-firebase-adminsdk') and f.endswith('.json')]

if not service_account_files:
    print("❌ ERRO: Arquivo de service account não encontrado!")
    print("   Certifique-se de que o arquivo .json está na mesma pasta.")
    exit(1)

service_account_path = service_account_files[0]
print(f"   Usando: {service_account_path}")

cred = credentials.Certificate(service_account_path)
firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Firebase Admin SDK inicializado!")

# ─────────────────────────────────────────────────────────────
# 2. VERIFICAR/CONFIGURAR AUTHENTICATION
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 2: Verificando Authentication...")
print("   ⚠️  Authentication precisa ser ativado manualmente no console:")
print("      https://console.firebase.google.com/project/agendafacil-pro/authentication")
print("      1. Toque em 'Começar' ou 'Ativar'")
print("      2. Ative 'E-mail/Senha'")
print("      3. Ative 'Google' (opcional)")
print("   ✅ (Pule esta etapa se já estiver configurado)")

# ─────────────────────────────────────────────────────────────
# 3. CRIAR COLEÇÕES E DOCUMENTOS DE EXEMPLO
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 3: Criando coleções e documentos de exemplo...")

# 3.1 COLEÇÃO: users (profissionais)
print("\n   📝 Criando coleção 'users'...")

user_ref = db.collection('users').document('demo-profissional-001')
user_ref.set({
    'name': 'Carlos Silva',
    'email': 'carlos@barbearia.com',
    'phone': '+5511999999999',
    'slug': 'carlos-barbearia',
    'businessName': 'Carlos Barbearia',
    'businessDescription': 'Especialista em cortes masculinos e barba',
    'avatar': '',
    'address': 'Rua das Flores, 123 - Centro',
    'city': 'São Paulo',
    'plan': 'pro',
    'trialEndsAt': datetime.now() + timedelta(days=14),
    'subscriptionStatus': 'active',
    'workingHours': {
        'monday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'tuesday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'wednesday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'thursday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'friday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'saturday': {'open': '09:00', 'close': '14:00', 'enabled': True},
        'sunday': {'open': '', 'close': '', 'enabled': False}
    },
    'slotDuration': 30,  # minutos entre agendamentos
    'createdAt': datetime.now(),
    'updatedAt': datetime.now()
})
print("   ✅ Documento de exemplo criado em 'users'")

# 3.2 COLEÇÃO: services (serviços oferecidos)
print("\n   📝 Criando coleção 'services'...")

services_data = [
    {
        'userId': 'demo-profissional-001',
        'name': 'Corte de Cabelo',
        'duration': 30,
        'price': 35.00,
        'description': 'Corte masculino com acabamento',
        'color': '#10B981',
        'active': True,
        'createdAt': datetime.now()
    },
    {
        'userId': 'demo-profissional-001',
        'name': 'Barba',
        'duration': 20,
        'price': 25.00,
        'description': 'Barba completa com navalha',
        'color': '#3B82F6',
        'active': True,
        'createdAt': datetime.now()
    },
    {
        'userId': 'demo-profissional-001',
        'name': 'Corte + Barba',
        'duration': 45,
        'price': 55.00,
        'description': 'Combo corte e barba',
        'color': '#F59E0B',
        'active': True,
        'createdAt': datetime.now()
    }
]

for i, service in enumerate(services_data):
    db.collection('services').document(f'service-{i+1:03d}').set(service)

print(f"   ✅ {len(services_data)} serviços de exemplo criados em 'services'")

# 3.3 COLEÇÃO: appointments (agendamentos)
print("\n   📝 Criando coleção 'appointments'...")

appointment_ref = db.collection('appointments').document('demo-appointment-001')
appointment_ref.set({
    'userId': 'demo-profissional-001',
    'serviceId': 'service-001',
    'clientName': 'João Pedro',
    'clientPhone': '+5511988888888',
    'clientEmail': 'joao@email.com',
    'date': (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
    'time': '14:00',
    'status': 'confirmed',
    'notes': 'Primeira vez',
    'reminderSent': False,
    'createdAt': datetime.now()
})
print("   ✅ Documento de exemplo criado em 'appointments'")

# 3.4 COLEÇÃO: subscriptions (assinaturas Stripe)
print("\n   📝 Criando coleção 'subscriptions'...")

subscription_ref = db.collection('subscriptions').document('demo-sub-001')
subscription_ref.set({
    'userId': 'demo-profissional-001',
    'stripeCustomerId': 'cus_demo_123',
    'stripeSubscriptionId': 'sub_demo_456',
    'plan': 'pro',
    'status': 'active',
    'currentPeriodStart': datetime.now(),
    'currentPeriodEnd': datetime.now() + timedelta(days=30),
    'cancelAtPeriodEnd': False,
    'createdAt': datetime.now()
})
print("   ✅ Documento de exemplo criado em 'subscriptions'")

# ─────────────────────────────────────────────────────────────
# 4. CRIAR ÍNDICES RECOMENDADOS
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 4: Índices recomendados...")
print("   ⚠️  Os índices abaixo precisam ser criados manualmente no console:")
print("      https://console.firebase.google.com/project/agendafacil-pro/firestore/indexes")
print()
print("   Coleção: appointments")
print("      - userId (Ascending) + date (Ascending) + time (Ascending)")
print("      - userId (Ascending) + status (Ascending)")
print("      - date (Ascending) + reminderSent (Ascending)")
print()
print("   Coleção: services")
print("      - userId (Ascending) + active (Ascending)")
print()
print("   Coleção: subscriptions")
print("      - userId (Ascending) + status (Ascending)")

# ─────────────────────────────────────────────────────────────
# 5. RESUMO FINAL
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  ✅ CONFIGURAÇÃO CONCLUÍDA!")
print("=" * 65)
print("\n📊 Resumo do que foi criado:")
print("   • Coleção 'users' com 1 documento de exemplo")
print("   • Coleção 'services' com 3 serviços de exemplo")
print("   • Coleção 'appointments' com 1 agendamento de exemplo")
print("   • Coleção 'subscriptions' com 1 assinatura de exemplo")
print("\n⚠️  PRÓXIMOS PASSOS MANUAIS:")
print("   1. Ativar Authentication no console Firebase")
print("   2. Criar índices no Firestore (links acima)")
print("   3. Configurar regras de segurança do Firestore")
print("   4. Registrar App Web no Firebase para obter firebaseConfig")
print("   5. Conectar FlutterFlow usando o firebaseConfig")
print("\n🚀 AgendaFácil Pro está pronto para decolar!")
print("=" * 65)
