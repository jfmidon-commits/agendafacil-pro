═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - GUIA DE CONFIGURAÇÃO DO FLUTTERFLOW
═══════════════════════════════════════════════════════════════

📱 PASSO 1: CRIAR CONTA E PROJETO
───────────────────────────────────────────────────────────────
1. Acesse: https://app.flutterflow.io
2. Crie uma conta (use o mesmo e-mail do Firebase)
3. Clique em "Create New"
4. Nome do projeto: "AgendaFácil Pro"
5. Template: "Blank"
6. Clique em "Create Project"


📱 PASSO 2: CONFIGURAR TEMA VISUAL
───────────────────────────────────────────────────────────────
Clique no ícone 🎨 "Theme Settings" no menu lateral esquerdo:

CORES:
  Primary:        #10B981  (Verde - botões principais)
  Secondary:      #3B82F6  (Azul - links secundários)
  Tertiary:       #F59E0B  (Âmbar - alertas)
  Alternate:      #1F2937  (Cinza escuro - texto)
  Primary BG:     #FFFFFF  (Branco - fundo)
  Secondary BG:   #F8F9FA  (Cinza claro - cards)

TIPOGRAFIA:
  Font Family:    Inter
  Headline Large:  32px, Bold
  Headline Medium: 24px, Bold
  Body Large:      16px, Regular
  Body Medium:     14px, Regular
  Label Large:     14px, Medium

COMPONENTES:
  Botões:         Border radius 12px, padding 16px vertical
  Cards:          Border radius 16px, sombra leve
  Inputs:         Border radius 12px, borda 1px #E5E7EB


📱 PASSO 3: CONECTAR AO FIREBASE
───────────────────────────────────────────────────────────────
1. No Firebase Console, vá em:
   Configurações do projeto → Seus aplicativos → </> (Web)

2. Copie o objeto firebaseConfig (vai parecer com isso):

   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "agendafacil-pro.firebaseapp.com",
     projectId: "agendafacil-pro",
     storageBucket: "agendafacil-pro.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };

3. No FlutterFlow:
   - Clique no ⚙️ "Settings" (engrenagem no canto superior direito)
   - Vá em "Integrations" → "Firebase"
   - Cole cada valor do firebaseConfig nos campos correspondentes
   - Clique em "Connect"


📱 PASSO 4: CRIAR AS TELAS
───────────────────────────────────────────────────────────────

TELA 1: booking_page (Página de Agendamento Pública)
─────────────────────────────────────────────────────────
Rota: /book/{slug}
Acesso: PÚBLICO (sem login)

Widgets (de cima para baixo):
┌─────────────────────────────────────┐
│  CircleAvatar (foto do negócio)     │
│  Text (businessName) - Headline     │
│  Text ("Escolha um serviço")        │
├─────────────────────────────────────┤
│  ListView de serviços:              │
│    [Icon] [Nome + Preço] [>]        │
├─────────────────────────────────────┤
│  Text ("Escolha uma data")          │
│  Horizontal ListView de datas       │
├─────────────────────────────────────┤
│  Text ("Horários disponíveis")      │
│  Wrap de ChoiceChips (horários)     │
├─────────────────────────────────────┤
│  TextField: Nome completo           │
│  TextField: WhatsApp                │
│  TextField: E-mail                  │
├─────────────────────────────────────┤
│  Button: "Confirmar agendamento"    │
│    (verde #10B981, largura total)   │
└─────────────────────────────────────┘

Backend Query (carregar profissional):
  Collection: users
  Filter: slug is equal to → page parameter "slug"

Backend Query (carregar serviços):
  Collection: services
  Filter: userId is equal to → users Document Reference

Action no botão "Confirmar":
  1. Backend Call → Create Document
     Collection: appointments
     Fields: (todos os campos do formulário + userId + serviceId)
  2. Navigate To → success_page


TELA 2: dashboard (Painel do Profissional)
─────────────────────────────────────────────────────────
Acesso: REQUER LOGIN

Widgets:
┌─────────────────────────────────────┐
│  AppBar: "AgendaFácil" + Settings   │
├─────────────────────────────────────┤
│  Text: "Olá, {name}!"               │
│  Text: "X agendamentos hoje"        │
├─────────────────────────────────────┤
│  Card: Seu link de agendamento      │
│  agendafacil.pro/{slug} [copiar]    │
├─────────────────────────────────────┤
│  TabBar: [Hoje] [Amanhã] [Próximos] │
├─────────────────────────────────────┤
│  ListView de agendamentos:          │
│  [Avatar] [Nome + Serviço + Hora]   │
│  [Menu: Confirmar/Cancelar/Concluir]│
├─────────────────────────────────────┤
│  FAB (+): Adicionar agendamento     │
└─────────────────────────────────────┘

Backend Query:
  Collection: appointments
  Filter: userId == current_user
  Filter: date == today
  Order By: time, Ascending


TELA 3: onboarding (Cadastro 3 Passos)
─────────────────────────────────────────────────────────
Acesso: PÚBLICO (antes do login)

Passo 1: Dados básicos
  - TextField: Nome completo
  - TextField: Nome do negócio
  - TextField: WhatsApp
  - Button: "Próximo"

Passo 2: Serviços
  - Text: "Quais serviços você oferece?"
  - ListView de chips pré-definidos:
    * Corte de cabelo (30 min)
    * Barba (20 min)
    * Corte + Barba (45 min)
    * Manicure (45 min)
    * Pedicure (60 min)
    * Massagem (60 min)
    * Outro (custom)
  - Button: "Próximo"

Passo 3: Horários
  - Para cada dia (Seg a Dom):
    * Switch: Aberto/Fechado
    * TimePicker: Horário início e fim
  - Dropdown: Intervalo entre agendamentos
  - Button: "Concluir"

Tela final:
  - Text: "🎉 Pronto!"
  - Text: "agendafacil.pro/{slug}"
  - Button: "Copiar link"
  - Button: "Ir para o painel"


📱 PASSO 5: CONFIGURAR NAVEGAÇÃO
───────────────────────────────────────────────────────────
No FlutterFlow, vá em "Navigation & Routing":

  /book/{slug}  → booking_page (pública)
  /dashboard    → dashboard (requer login)
  /onboarding   → onboarding (pública)
  /login        → login (pública)
  /success      → success_page (pública)


📱 PASSO 6: PUBLICAR NO FIREBASE HOSTING
───────────────────────────────────────────────────────────
1. No FlutterFlow:
   - Clique no 🚀 "Deploy" (canto superior direito)
   - Selecione "Firebase Hosting"
   - Escolha o projeto "agendafacil-pro"
   - Clique em "Deploy"

2. Seu app estará disponível em:
   https://agendafacil-pro.web.app


═══════════════════════════════════════════════════════════════
  ✅ FLUTTERFLOW CONFIGURADO!
═══════════════════════════════════════════════════════════════
