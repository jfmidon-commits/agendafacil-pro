# ADR-001 — Migrar o MVP para Next.js + Supabase

**Status:** Aceito  
**Data:** 2026-08-28

## Contexto

O repositório atual contém regras Firestore, scripts Python e documentação do FlutterFlow, mas não contém o código exportado do frontend FlutterFlow. Isso impede revisão completa, testes automatizados e deploy reproduzível do fluxo vertical slice a partir do GitHub.

Também foram encontrados desvios entre documentação e implementação, incluindo Stripe sem verificação de assinatura do webhook e duplicação de estado de plano entre `users` e `subscriptions`.

## Decisão

O caminho principal do MVP passa a ser:

- **Frontend + API:** Next.js (App Router, TypeScript)
- **Auth + banco:** Supabase Auth + PostgreSQL
- **Segurança:** RLS; dados privados e públicos em tabelas separadas
- **Booking:** RPC transacional `book_appointment` + exclusion constraint PostgreSQL
- **Pagamentos:** Stripe; `subscriptions` é a fonte oficial de verdade para assinatura paga
- **WhatsApp:** Make continua como orquestrador, chamado por webhooks/outbox do app
- **Deploy:** Vercel + Supabase

O material Firebase/FlutterFlow permanece no repositório como **legado de referência** até a validação do novo vertical slice.

## Por que esta opção

1. O frontend passa a existir no Git e pode receber testes/PRs.
2. PostgreSQL oferece uma `EXCLUDE CONSTRAINT` para impedir sobreposição de horários no próprio banco, mesmo sob concorrência.
3. RLS permite manter dados de agenda privados e expor somente perfil/serviços necessários ao booking público.
4. Stripe pode ser sincronizado idempotentemente e separado de estado de trial.
5. A aplicação deixa de depender de configuração manual do FlutterFlow para ser reproduzível.

## Consequências

- Há custo inicial de migração.
- Será necessário criar/configurar um projeto Supabase e um projeto Vercel antes do beta.
- URLs reais de Make, chaves Stripe e secrets serão configurados somente por variáveis de ambiente; nunca no repositório.

## Limites do legado FlutterFlow

Se o FlutterFlow continuar sendo usado temporariamente, ele não deve criar `appointments` diretamente. O frontend legado deve chamar a API segura e tratar o Firestore apenas como legado até a migração terminar.
