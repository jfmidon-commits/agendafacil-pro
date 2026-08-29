# 🚀 AgendaFácil Pro — Ambiente de Staging

## 📋 Status do Ambiente

| Serviço | Status | URL |
|---------|--------|-----|
| Frontend (Vercel) | 🟡 Configurando | `https://agendafacil-staging.vercel.app` |
| Banco (Supabase) | 🟡 Configurando | `https://[ref].supabase.co` |
| API | 🟡 Configurando | `/api/*` |

## 🗄️ Banco de Dados

### Migrations

```bash
# Executar todas as migrations
export SUPABASE_DB_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
./scripts/setup-supabase.sh
```

### Estrutura

```
profiles          → Perfis de usuário (estende auth.users)
businesses        → Negócios cadastrados
professionals     → Profissionais de cada negócio
services          → Serviços oferecidos
availability      → Disponibilidade semanal
appointments      → Agendamentos
```

### Seed de Teste

```bash
psql $SUPABASE_DB_URL -f scripts/seed_test_data.sql
```

## 🔧 Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp web/.env.example web/.env.local
```

| Variável | Descrição | Onde obter |
|----------|-----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Dashboard Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Dashboard Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (server-only) | Dashboard Supabase → API |
| `NEXT_PUBLIC_APP_URL` | URL da aplicação | Vercel deployment URL |

## 🧪 Testes

### 1. Criar conta
Acesse `/auth/signup` e crie uma conta com email real.

### 2. Cadastrar negócio
No painel, cadastre seu negócio com slug único.

### 3. Cadastrar profissional
Adicione um profissional com nome e bio.

### 4. Cadastrar serviço
Exemplo: **Corte — 30 min — R$35**

### 5. Definir disponibilidade
Configure horários de atendimento (ex: Seg-Sex 9h-18h).

### 6. Link público
Acesse `/{slug}` para ver a página de agendamento.

### 7. Fazer reserva
Em outro celular/navegador (sem login), faça uma reserva.

### 8. Verificar no painel
Confirme que a reserva aparece no painel administrativo.

### 9. Teste de concorrência
Tente reservar o mesmo horário em dois dispositivos simultaneamente.
O sistema deve bloquear o segundo com erro de double-booking.

## 🔄 CI/CD

- **Lint + TypeCheck + Test + Build**: Disparado em push para `main` e `develop`
- **Deploy Staging**: Disparado em push para `develop`
- **Deploy Produção**: Manual via workflow dispatch

## 📝 Próximos Passos

1. [ ] Conectar Make.com para notificações WhatsApp
2. [ ] Configurar Stripe para pagamentos
3. [ ] Implementar sistema de trial
4. [ ] Adicionar lembretes automáticos
