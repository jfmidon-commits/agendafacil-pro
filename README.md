═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - KIT DE CONFIGURAÇÃO COMPLETO
═══════════════════════════════════════════════════════════════

Este pacote contém TUDO que você precisa para configurar o
AgendaFácil Pro do zero. Siga a ordem dos passos abaixo.


📁 ARQUIVOS INCLUÍDOS
═══════════════════════════════════════════════════════════════

1. setup_firebase.py          → Script Python para criar coleções
2. firestore_rules.txt        → Regras de segurança do Firestore
3. data_structure.json        → Estrutura completa do banco de dados
4. flutterflow_guide.txt      → Guia passo a passo do FlutterFlow
5. make_automation_guide.txt  → Guia de automações no Make
6. README.txt                 → Este arquivo (guia geral)


🚀 ORDEM DE EXECUÇÃO
═══════════════════════════════════════════════════════════════

ETAPA 1: CONFIGURAR FIREBASE (pelo celular ou PC)
───────────────────────────────────────────────────────────────
□ 1.1 Acesse: https://console.firebase.google.com/project/agendafacil-pro
□ 1.2 Criar Firestore Database:
     → Menu lateral → "Bancos de dados" → "Firestore Database"
     → "Criar banco de dados" → "Modo de teste"
     → Região: southamerica-east1 (São Paulo)
□ 1.3 Ativar Authentication:
     → Menu lateral → "Authentication" → "Começar"
     → Ativar "E-mail/Senha" e "Google"
□ 1.4 Registrar App Web:
     → Visão geral do projeto → "</>" (Web)
     → Nome: "AgendaFácil Pro Web"
     → Copiar o firebaseConfig (guarde!)
□ 1.5 Configurar regras de segurança:
     → Firestore Database → aba "Regras"
     → Cole o conteúdo de "firestore_rules.txt"
     → Publicar


ETAPA 2: CRIAR COLEÇÕES (rode o script Python)
───────────────────────────────────────────────────────────────
□ 2.1 Instalar Python 3.8+ (se não tiver): https://python.org
□ 2.2 Instalar dependências:
     pip install firebase-admin
□ 2.3 Coloque estes arquivos na mesma pasta:
     - setup_firebase.py
     - agendafacil-pro-firebase-adminsdk-*.json (service account)
□ 2.4 Execute:
     python setup_firebase.py
□ 2.5 O script criará:
     - Coleção "users" com 1 documento de exemplo
     - Coleção "services" com 3 serviços de exemplo
     - Coleção "appointments" com 1 agendamento de exemplo
     - Coleção "subscriptions" com 1 assinatura de exemplo


ETAPA 3: CONFIGURAR FLUTTERFLOW (app)
───────────────────────────────────────────────────────────────
□ 3.1 Acesse: https://app.flutterflow.io
□ 3.2 Crie conta e projeto em branco
□ 3.3 Siga o guia completo em "flutterflow_guide.txt"
□ 3.4 Conecte ao Firebase usando o firebaseConfig da Etapa 1.4
□ 3.5 Crie as telas: booking_page, dashboard, onboarding
□ 3.6 Publique no Firebase Hosting


ETAPA 4: CONFIGURAR MAKE (automações)
───────────────────────────────────────────────────────────────
□ 4.1 Acesse: https://make.com
□ 4.2 Crie conta (plano Free)
□ 4.3 Siga o guia em "make_automation_guide.txt"
□ 4.4 Configure os 4 cenários:
     - Notificação de novo agendamento
     - Lembretes 24h antes
     - Alerta de trial expirando
     - Webhook Stripe → Firestore


ETAPA 5: CONFIGURAR STRIPE (pagamentos)
───────────────────────────────────────────────────────────────
□ 5.1 Acesse: https://stripe.com/br
□ 5.2 Crie conta
□ 5.3 Crie produtos:
     - "AgendaFácil Pro Mensal" → R$ 39/mês
     - "AgendaFácil Pro Anual" → R$ 348/ano
     - "AgendaFácil Studio" → R$ 79/mês
□ 5.4 Configure webhooks para o Make


ETAPA 6: LANDING PAGE
───────────────────────────────────────────────────────────────
□ 6.1 Acesse: https://carrd.co
□ 6.2 Crie landing page com copywriting persuasivo
□ 6.3 Configure domínio personalizado (opcional)


ETAPA 7: LANÇAMENTO
───────────────────────────────────────────────────────────────
□ 7.1 Teste beta com 5 profissionais conhecidos
□ 7.2 Colete feedback
□ 7.3 Ajuste o app conforme necessário
□ 7.4 Lançamento público nas redes sociais


📞 SUPORTE E DÚVIDAS
═══════════════════════════════════════════════════════════════

Se tiver dúvidas em qualquer etapa, me pergunte! Estou aqui
para ajudar a configurar cada parte.

Bom trabalho! 🚀
