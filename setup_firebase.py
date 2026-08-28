#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO v2.0 - SETUP FIREBASE (SPRINT 0)

  Este script configura automaticamente:
  - Firestore Database com estrutura segura
  - Coleções: users, publicProfiles, services, appointments,
    subscriptions, availabilityRules, scheduleBlocks
  - Dados de exemplo para testes
  - Índices recomendados

  PRÉ-REQUISITOS:
  - Python 3.8+
  - pip install firebase-admin
  - Service account key na mesma pasta

  USO:
  python setup_firebase.py
═══════════════════════════════════════════════════════════════
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from datetime import datetime, timedelta, timezone

print("=" * 65)
print("  🚀 AGENDAFÁCIL PRO v2.0 - SETUP FIREBASE (SPRINT 0)")
print("=" * 65)

# ─────────────────────────────────────────────────────────────
# 1. INICIALIZAR FIREBASE ADMIN SDK
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 1: Inicializando Firebase Admin SDK...")

service_account_files = [f for f in os.listdir('.') 
                         if f.startswith('agendafacil-pro-firebase-adminsdk') 
                         and f.endswith('.json')]

if not service_account_files:
    print("❌ ERRO: Arquivo de service account não encontrado!")
    exit(1)

service_account_path = service_account_files[0]
print(f"   Usando: {service_account_path}")

cred = credentials.Certificate(service_account_path)
firebase_admin.initialize_app(cred)
db = firestore.client()
print("✅ Firebase Admin SDK inicializado!")

# ─────────────────────────────────────────────────────────────
# 2. COLEÇÃO: users (DADOS PRIVADOS)
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 2: Criando coleção 'users' (dados privados)...")

user_ref = db.collection('users').document('demo-profissional-001')
user_ref.set({
    'name': 'Carlos Silva',
    'email': 'carlos@barbearia.com',
    'phone': '+5511999999999',
    'plan': 'pro',
    'trialStatus': 'active',
    'trialEndsAt': datetime.now(timezone.utc) + timedelta(days=14),
    'subscriptionStatus': 'active',
    'stripeCustomerId': 'cus_demo_123',
    'createdAt': datetime.now(timezone.utc),
    'updatedAt': datetime.now(timezone.utc)
})
print("   ✅ Documento de exemplo criado em 'users'")

# ─────────────────────────────────────────────────────────────
# 3. COLEÇÃO: publicProfiles (DADOS PÚBLICOS)
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 3: Criando coleção 'publicProfiles' (dados públicos)...")

public_ref = db.collection('publicProfiles').document('demo-profissional-001')
public_ref.set({
    'userId': 'demo-profissional-001',
    'slug': 'carlos-barbearia',
    'businessName': 'Carlos Barbearia',
    'businessDescription': 'Especialista em cortes masculinos e barba',
    'avatar': 'https://ui-avatars.com/api/?name=Carlos+Silva&background=10B981&color=fff',
    'address': 'Rua das Flores, 123 - Centro',
    'city': 'São Paulo',
    'state': 'SP',
    'workingHours': {
        'monday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'tuesday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'wednesday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'thursday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'friday': {'open': '09:00', 'close': '18:00', 'enabled': True},
        'saturday': {'open': '09:00', 'close': '14:00', 'enabled': True},
        'sunday': {'open': '', 'close': '', 'enabled': False}
    },
    'slotDuration': 30,
    'bufferBefore': 5,
    'bufferAfter': 5,
    'timezone': 'America/Sao_Paulo',
    'isActive': True,
    'createdAt': datetime.now(timezone.utc),
    'updatedAt': datetime.now(timezone.utc)
})
print("   ✅ Documento de exemplo criado em 'publicProfiles'")

# ─────────────────────────────────────────────────────────────
# 4. COLEÇÃO: services
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 4: Criando coleção 'services'...")

services_data = [
    {
        'userId': 'demo-profissional-001',
        'name': 'Corte de Cabelo',
        'duration': 30,
        'price': 35.00,
        'description': 'Corte masculino com acabamento',
        'color': '#10B981',
        'bufferBefore': 5,
        'bufferAfter': 5,
        'active': True,
        'createdAt': datetime.now(timezone.utc)
    },
    {
        'userId': 'demo-profissional-001',
        'name': 'Barba',
        'duration': 20,
        'price': 25.00,
        'description': 'Barba completa com navalha',
        'color': '#3B82F6',
        'bufferBefore': 5,
        'bufferAfter': 5,
        'active': True,
        'createdAt': datetime.now(timezone.utc)
    },
    {
        'userId': 'demo-profissional-001',
        'name': 'Corte + Barba',
        'duration': 45,
        'price': 55.00,
        'description': 'Combo corte e barba com desconto',
        'color': '#F59E0B',
        'bufferBefore': 5,
        'bufferAfter': 5,
        'active': True,
        'createdAt': datetime.now(timezone.utc)
    }
]

for i, service in enumerate(services_data):
    db.collection('services').document(f'service-{i+1:03d}').set(service)

print(f"   ✅ {len(services_data)} serviços de exemplo criados")

# ─────────────────────────────────────────────────────────────
# 5. COLEÇÃO: availabilityRules
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 5: Criando coleção 'availabilityRules'...")

days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
for i, day in enumerate(days):
    is_weekday = i < 5
    rule = {
        'userId': 'demo-profissional-001',
        'dayOfWeek': i,
        'dayName': day,
        'startTime': '09:00' if is_weekday or i == 5 else '',
        'endTime': '18:00' if is_weekday else ('14:00' if i == 5 else ''),
        'isAvailable': is_weekday or i == 5,
        'slotDuration': 30,
        'bufferBefore': 5,
        'bufferAfter': 5,
        'createdAt': datetime.now(timezone.utc)
    }
    db.collection('availabilityRules').document(f'rule-{i}').set(rule)

print("   ✅ 7 regras de disponibilidade criadas")

# ─────────────────────────────────────────────────────────────
# 6. COLEÇÃO: scheduleBlocks
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 6: Criando coleção 'scheduleBlocks'...")

# Bloqueio de almoço de segunda a sexta
for i in range(5):
    block_date = (datetime.now(timezone.utc) + timedelta(days=i)).strftime('%Y-%m-%d')
    db.collection('scheduleBlocks').document(f'block-lunch-{i}').set({
        'userId': 'demo-profissional-001',
        'startAt': datetime.strptime(f'{block_date}T12:00:00', '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc),
        'endAt': datetime.strptime(f'{block_date}T13:00:00', '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc),
        'reason': 'Almoço',
        'type': 'break',
        'createdAt': datetime.now(timezone.utc)
    })

print("   ✅ 5 bloqueios de almoço criados")

# ─────────────────────────────────────────────────────────────
# 7. COLEÇÃO: appointments (COM startsAt, endsAt, timezone)
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 7: Criando coleção 'appointments' (v2.0)...")

tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
starts_at = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
ends_at = tomorrow.replace(hour=14, minute=30, second=0, microsecond=0)

appointment_ref = db.collection('appointments').document('demo-appointment-001')
appointment_ref.set({
    'userId': 'demo-profissional-001',
    'serviceId': 'service-001',
    'serviceName': 'Corte de Cabelo',
    'serviceDuration': 30,
    'bufferBefore': 5,
    'bufferAfter': 5,
    'totalDuration': 40,
    'clientName': 'João Pedro',
    'clientPhone': '+5511988888888',
    'clientEmail': 'joao@email.com',
    'startsAt': starts_at,
    'endsAt': ends_at,
    'timezone': 'America/Sao_Paulo',
    'status': 'confirmed',
    'notes': 'Primeira vez',
    'reminderSent': False,
    'cancelledAt': None,
    'cancelledBy': None,
    'createdAt': datetime.now(timezone.utc)
})
print("   ✅ Documento de exemplo criado em 'appointments'")

# ─────────────────────────────────────────────────────────────
# 8. COLEÇÃO: subscriptions
# ─────────────────────────────────────────────────────────────
print("\n📋 Etapa 8: Criando coleção 'subscriptions'...")

subscription_ref = db.collection('subscriptions').document('demo-sub-001')
subscription_ref.set({
    'userId': 'demo-profissional-001',
    'stripeCustomerId': 'cus_demo_123',
    'stripeSubscriptionId': 'sub_demo_456',
    'plan': 'pro',
    'status': 'active',
    'currentPeriodStart': datetime.now(timezone.utc),
    'currentPeriodEnd': datetime.now(timezone.utc) + timedelta(days=30),
    'cancelAtPeriodEnd': False,
    'createdAt': datetime.now(timezone.utc),
    'updatedAt': datetime.now(timezone.utc)
})
print("   ✅ Documento de exemplo criado em 'subscriptions'")

# ─────────────────────────────────────────────────────────────
# 9. RESUMO
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  ✅ SETUP CONCLUÍDO!")
print("=" * 65)
print("\n📊 Coleções criadas:")
print("   • users (dados privados)")
print("   • publicProfiles (dados públicos)")
print("   • services")
print("   • availabilityRules")
print("   • scheduleBlocks")
print("   • appointments (v2.0 com startsAt/endsAt)")
print("   • subscriptions")
print("\n⚠️  PRÓXIMOS PASSOS:")
print("   1. Atualizar regras de segurança do Firestore")
print("   2. Criar índices no Firestore")
print("   3. Implementar API /api/book")
print("   4. Configurar webhooks Stripe e Make")
print("=" * 65)
