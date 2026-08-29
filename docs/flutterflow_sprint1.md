# 🎨 FLUTTERFLOW - GUIA DE TELAS (SPRINT 1)

## Telas a Criar

### 1. TELA: `onboarding_step1` (Dados Básicos)
**Rota:** `/onboarding` (pública)

```
Scaffold
  └── SafeArea
      └── SingleChildScrollView
          └── Padding (24)
              └── Column (center)
                  ├── Text ("Bem-vindo ao AgendaFácil Pro", Headline Large, Bold)
                  ├── SizedBox (8)
                  ├── Text ("Crie seu link de agendamento em 2 minutos", Body Medium, Gray)
                  ├── SizedBox (40)
                  ├── TextField (Nome completo, hint: "Seu nome")
                  ├── SizedBox (16)
                  ├── TextField (E-mail, hint: "seu@email.com", keyboard: email)
                  ├── SizedBox (16)
                  ├── TextField (WhatsApp, hint: "(11) 99999-9999", keyboard: phone)
                  ├── SizedBox (16)
                  ├── TextField (Nome do negócio, hint: "Ex: Carlos Barbearia")
                  ├── SizedBox (32)
                  └── ElevatedButton (
                        text: "Próximo",
                        bg: #10B981, width: full, height: 56, radius: 12,
                        onPressed: → Validate → Create user in Firebase Auth → Navigate to onboarding_step2
                      )
```

**Backend Actions:**
1. `Create Account` (Firebase Auth) → e-mail + senha temporária
2. `Create Document` (users) → userId, name, email, phone, plan: 'free', trialStatus: 'active', trialEndsAt: now+14d
3. `Create Document` (publicProfiles) → userId, slug (auto-generated), businessName
4. Navigate to `onboarding_step2`

---

### 2. TELA: `onboarding_step2` (Serviços)
**Rota:** `/onboarding/services`

```
Scaffold
  └── SafeArea
      └── Padding (24)
          └── Column
              ├── Text ("Quais serviços você oferece?", Headline Medium)
              ├── SizedBox (8)
              ├── Text ("Toque para adicionar", Body Small, Gray)
              ├── SizedBox (24)
              ├── ListView (shrinkWrap)
              │   └── PredefinedServiceCard (para cada serviço pré-definido)
              │       ├── Container (padding 16, radius 12, border 1px #E5E7EB)
              │       ├── Row
              │       │   ├── CircleAvatar (radius 20, bg: serviceColor, icon: scissors)
              │       │   ├── SizedBox (12)
              │       │   ├── Column (crossAxis: start)
              │       │   │   ├── Text (serviceName, Body Large, Bold)
              │       │   │   └── Text ("{duration} min • R$ {price}", Body Small, Gray)
              │       │   └── Checkbox (value: selected)
              │       └── (quando expandido)
              │           ├── TextField (preço personalizado)
              │           └── TextField (duração personalizada)
              ├── SizedBox (16)
              ├── OutlinedButton ("+ Adicionar serviço personalizado", icon: add)
              ├── Spacer
              └── ElevatedButton (
                    text: "Próximo",
                    bg: #10B981, width: full, height: 56,
                    onPressed: → Save services → Navigate to onboarding_step3
                  )
```

**Serviços Pré-definidos:**
- Corte de Cabelo (30 min, R$ 35)
- Barba (20 min, R$ 25)
- Corte + Barba (45 min, R$ 55)
- Manicure (45 min, R$ 30)
- Pedicure (60 min, R$ 40)
- Massagem (60 min, R$ 80)

**Backend:**
- `Create Document` (services) para cada serviço selecionado
- userId = current_user.uid

---

### 3. TELA: `onboarding_step3` (Horários)
**Rota:** `/onboarding/schedule`

```
Scaffold
  └── SafeArea
      └── Padding (24)
          └── Column
              ├── Text ("Seus horários de atendimento", Headline Medium)
              ├── SizedBox (8)
              ├── Text ("Configure quando você atende", Body Small, Gray)
              ├── SizedBox (24)
              ├── ListView (shrinkWrap)
              │   └── DayScheduleRow (para cada dia)
              │       ├── Row
              │       │   ├── Text ("Segunda", Body Large, width: 80)
              │       │   ├── Switch (value: isOpen, activeColor: #10B981)
              │       │   └── (se aberto)
              │       │       ├── TimePicker (início, "09:00")
              │       │       ├── Text ("até")
              │       │       └── TimePicker (fim, "18:00")
              ├── SizedBox (24)
              ├── Text ("Intervalo entre agendamentos", Body Medium, Bold)
              ├── SizedBox (8)
              ├── DropdownButton (
                    value: 30,
                    items: [15, 30, 45, 60],
                    hint: "30 minutos"
                  )
              ├── SizedBox (24)
              ├── Text ("Pausa para almoço", Body Medium, Bold)
              ├── SizedBox (8)
              ├── Row
              │   ├── TimePicker ("12:00")
              │   ├── Text ("até")
              │   └── TimePicker ("13:00")
              ├── Spacer
              └── ElevatedButton (
                    text: "Concluir",
                    bg: #10B981, width: full, height: 56,
                    onPressed: → Save availabilityRules + scheduleBlocks → Generate slug → Navigate to onboarding_success
                  )
```

**Backend:**
- `Create Document` (availabilityRules) para cada dia ativo
- `Create Document` (scheduleBlocks) para almoço de segunda a sexta
- `Update Document` (publicProfiles) → workingHours, slotDuration
- Auto-generate slug: `businessName.toLowerCase().replace(/\s+/g, '-')`

---

### 4. TELA: `onboarding_success` (Link Gerado)
**Rota:** `/onboarding/success`

```
Scaffold
  └── SafeArea
      └── Padding (24)
          └── Column (center)
              ├── Icon (Icons.check_circle, size: 80, color: #10B981)
              ├── SizedBox (24)
              ├── Text ("🎉 Pronto!", Headline Large, Bold)
              ├── SizedBox (8)
              ├── Text ("Seu link de agendamento está no ar:", Body Medium)
              ├── SizedBox (24)
              ├── Container (padding 20, radius 16, bg: #F0FDF4, border: 2px #10B981)
              │   └── Column
              │       ├── Text ("agendafacil.pro/", Body Medium, Gray)
              │       ├── Text ("{slug}", Headline Small, Bold, #10B981)
              │       └── SizedBox (12)
              │       └── OutlinedButton (
              │             text: "📋 Copiar link",
              │             onPressed: → Copy to clipboard
              │           )
              ├── SizedBox (32)
              ├── Text ("Compartilhe com seus clientes!", Body Medium)
              ├── SizedBox (24)
              └── ElevatedButton (
                    text: "Ir para meu painel →",
                    bg: #10B981, width: full, height: 56,
                    onPressed: → Navigate to dashboard
                  )
```

---

### 5. TELA: `booking_page` (Página Pública de Agendamento)
**Rota:** `/book/{slug}` (pública, sem login)

```
Scaffold
  └── SafeArea
      └── SingleChildScrollView
          └── Column
              ├── Container (padding 24, bg: #F8F9FA)
              │   └── Column (center)
              │       ├── CircleAvatar (radius: 40, bgImage: publicProfile.avatar)
              │       ├── SizedBox (16)
              │       ├── Text (publicProfile.businessName, Headline Medium, Bold)
              │       ├── SizedBox (4)
              │       ├── Text (publicProfile.businessDescription, Body Small, Gray)
              │       └── Text ("📍 {address}, {city}", Body Small, Gray)
              │
              ├── (se não selecionou serviço)
              │   ├── Padding (24)
              │   │   └── Text ("Escolha um serviço", Headline Small, Bold)
              │   ├── ListView (shrinkWrap)
              │   │   └── ServiceCard
              │   │       ├── Container (padding 16, radius 12, border)
              │   │       ├── Row
              │   │       │   ├── CircleAvatar (bg: service.color, icon)
              │   │       │   ├── Column (crossAxis: start)
              │   │       │   │   ├── Text (service.name, Body Large, Bold)
              │   │       │   │   └── Text ("{duration} min • R$ {price}", Body Small)
              │   │       │   └── Icon (chevron_right)
              │   │       └── onTap: → Select service → Show date picker
              │
              ├── (se selecionou serviço, mostrar datas)
              │   ├── Padding (24)
              │   │   └── Text ("Escolha uma data", Headline Small, Bold)
              │   ├── Container (height: 90)
              │   │   └── ListView (horizontal)
              │   │       └── DateCard (para cada dia disponível)
              │   │           ├── Container (width: 70, margin: 6, radius: 12, border)
              │   │           │   └── Column (center)
              │   │           │       ├── Text (diaSemana, Body Small)
              │   │           │       ├── Text (numeroDia, Headline Small, Bold)
              │   │           │       └── Text (mes, Body Small)
              │   │           └── onTap: → Select date → Load available slots
              │
              ├── (se selecionou data, mostrar horários)
              │   ├── Padding (24)
              │   │   └── Text ("Horários disponíveis", Headline Small, Bold)
              │   ├── Wrap (spacing: 10, runSpacing: 10, padding: 24)
              │   │   └── TimeChip (para cada slot)
              │   │       ├── ChoiceChip (
              │   │       │   label: Text ("14:00"),
              │   │       │   selected: isSelected,
              │   │       │   selectedColor: #10B981,
              │   │       │   onSelected: → Select time
              │   │       │)
              │   │       └── (se !available) → disabled, bg: Gray 200
              │
              ├── (se selecionou horário, mostrar formulário)
              │   ├── Padding (24)
              │   │   └── Text ("Seus dados", Headline Small, Bold)
              │   ├── Padding (horizontal: 24)
              │   │   └── Column
              │   │       ├── TextField (Nome completo)
              │   │       ├── SizedBox (12)
              │   │       ├── TextField (WhatsApp, keyboard: phone)
              │   │       ├── SizedBox (12)
              │   │       ├── TextField (E-mail, keyboard: email)
              │   │       ├── SizedBox (12)
              │   │       └── TextField (Observações, maxLines: 2, optional)
              │   ├── SizedBox (24)
              │   └── Padding (24)
              │       └── ElevatedButton (
              │             text: "Confirmar agendamento",
              │             bg: #10B981, width: full, height: 56,
              │             onPressed: → Call API /api/book → Show success
              │           )
```

**Backend Queries:**
1. `Query Collection` (publicProfiles) → Filter: slug == page parameter
2. `Query Collection` (services) → Filter: userId == publicProfile.userId, active == true
3. `API Call` (GET) → `/api/available-slots?userId={uid}&date={date}&serviceId={sid}`
4. `API Call` (POST) → `/api/book` → Body: {userId, serviceId, clientName, clientPhone, startsAt}

---

### 6. TELA: `booking_success` (Confirmação)
**Rota:** `/book/{slug}/success` (pública)

```
Scaffold
  └── SafeArea
      └── Padding (24)
          └── Column (center)
              ├── Icon (Icons.check_circle, size: 80, color: #10B981)
              ├── SizedBox (24)
              ├── Text ("✅ Agendamento Confirmado!", Headline Medium, Bold)
              ├── SizedBox (16)
              ├── Card (elevation: 2, radius: 16)
              │   └── Padding (20)
              │       └── Column (crossAxis: start)
              │           ├── Row [Icon(Icons.calendar_today), Text ("{date}")]
              │           ├── Row [Icon(Icons.access_time), Text ("{time}")]
              │           ├── Row [Icon(Icons.content_cut), Text ("{serviceName}")]
              │           ├── Row [Icon(Icons.person), Text ("{professionalName}")]
              │           └── Divider
              │           ├── Text ("📱 Você receberá um lembrete no WhatsApp", Body Small)
              │           └── Text ("📍 {address}", Body Small)
              ├── SizedBox (32)
              ├── Text ("Adicione ao seu calendário:", Body Medium)
              ├── SizedBox (12)
              ├── Row (mainAxis: center)
              │   ├── OutlinedButton ("Google Calendar", icon: calendar)
              │   └── OutlinedButton ("Outlook", icon: calendar)
              ├── Spacer
              └── Text ("Obrigado! Nos vemos lá 😊", Body Medium, Gray)
```

---

### 7. TELA: `dashboard` (Painel do Profissional)
**Rota:** `/dashboard` (requer login)

```
Scaffold
  └── SafeArea
      └── Column
          ├── AppBar (transparent, elevation: 0)
          │   └── Row
          │       ├── Column (crossAxis: start)
          │       │   ├── Text ("AgendaFácil", style: Label, color: #10B981)
          │       │   └── Text ("Olá, {user.name}! 👋", Headline Small, Bold)
          │       └── Row
          │           ├── IconButton (Icons.notifications, badge: newCount)
          │           └── IconButton (Icons.settings → profile_page)
          │
          ├── Container (padding: 20)
          │   └── Card (elevation: 2, radius: 16, bg: gradient #10B981 → #059669)
          │       └── Padding (20)
          │           └── Column (crossAxis: start)
          │               ├── Row
          │               │   ├── Text ("Seu link de agendamento", Body Small, White 80%)
          │               │   └── Spacer
          │               │   └── Container (padding: 4 12, radius: 20, bg: White 20%)
          │               │       └── Text ("{plan} | {trialDays} dias restantes", Body Small, White)
          │               ├── SizedBox (8)
          │               ├── Text ("agendafacil.pro/{slug}", Headline Small, Bold, White)
              │               ├── SizedBox (12)
              │               └── Row
              │                   ├── OutlinedButton ("📋 Copiar", textColor: White, borderColor: White 50%)
              │                   └── OutlinedButton ("🔗 Compartilhar", textColor: White, borderColor: White 50%)
          │
          ├── Container (padding: horizontal 20)
          │   └── Row (mainAxis: spaceBetween)
          │       ├── StatCard (icon: calendar, value: "{todayCount}", label: "Hoje")
          │       ├── StatCard (icon: attach_money, value: "R$ {todayRevenue}", label: "Faturamento")
          │       └── StatCard (icon: people, value: "{monthCount}", label: "Este mês")
          │
          ├── TabBar (
          │     tabs: ["Hoje", "Amanhã", "Próximos 7 dias"],
          │     indicatorColor: #10B981,
          │     labelColor: #10B981,
          │   )
          │
          ├── Expanded
          │   └── TabBarView
          │       └── ListView
          │           └── AppointmentCard (para cada agendamento)
          │               ├── Container (margin: 12 20, padding: 16, radius: 16, bg: White, elevation: 1)
          │               ├── Row
          │               │   ├── Container (width: 4, height: 50, radius: 2, bg: service.color)
          │               │   ├── SizedBox (12)
          │               │   ├── Expanded
          │               │   │   └── Column (crossAxis: start)
          │               │   │       ├── Text ("{clientName}", Body Large, Bold)
          │               │   │       ├── Text ("{serviceName} • {time}", Body Medium, Gray)
          │               │   │       └── Text ("{phone}", Body Small, Gray)
          │               │   └── PopupMenuButton
          │               │       ├── "✅ Confirmar" (se pending)
          │               │       ├── "✔️ Concluir"
          │               │       ├── "🔄 Reagendar"
          │               │       └── "❌ Cancelar"
          │               └── (se cancelado)
          │                   └── Container (padding: 4 8, radius: 4, bg: Red 100)
          │                       └── Text ("Cancelado", Body Small, Red)
          │
          └── FloatingActionButton (
                bg: #10B981, icon: Icons.add,
                onPressed: → Navigate to add_appointment_page
              )
```

**Backend Queries:**
1. `Query Collection` (users) → Document: current_user.uid
2. `Query Collection` (publicProfiles) → Filter: userId == current_user.uid
3. `Query Collection` (appointments) → Filter: userId == current_user.uid, startsAt >= today, startsAt < tomorrow, OrderBy: startsAt ASC
4. Stats: Count + Sum (price) dos agendamentos do dia

---

### 8. TELA: `add_appointment` (Adicionar Manualmente)
**Rota:** `/dashboard/add` (requer login)

```
Scaffold
  └── AppBar (title: "Novo Agendamento", backButton)
  └── SafeArea
      └── SingleChildScrollView
          └── Padding (24)
              └── Column
                  ├── DropdownButton (Serviço, items: services do profissional)
                  ├── SizedBox (16)
                  ├── DatePicker (Data)
                  ├── SizedBox (16)
                  ├── TimePicker (Horário)
                  ├── SizedBox (16)
                  ├── TextField (Nome do cliente)
                  ├── SizedBox (16)
                  ├── TextField (WhatsApp)
                  ├── SizedBox (16)
                  ├── TextField (E-mail, optional)
                  ├── SizedBox (16)
                  ├── TextField (Observações, maxLines: 3)
                  ├── Spacer
                  └── ElevatedButton (
                        text: "Salvar agendamento",
                        bg: #10B981, width: full, height: 56,
                        onPressed: → Call API /api/book → Navigate back
                      )
```

---

## 🎨 Componentes Reutilizáveis (Criar no FlutterFlow)

### 1. `StatCard`
```
Container (width: 100, padding: 16, radius: 16, bg: White, elevation: 1)
  └── Column (center)
      ├── Icon (icon, size: 24, color: #10B981)
      ├── SizedBox (8)
      ├── Text (value, Headline Small, Bold)
      └── Text (label, Body Small, Gray)
```

### 2. `ServiceCard`
```
Container (padding: 16, radius: 12, border: 1px #E5E7EB)
  └── Row
      ├── CircleAvatar (radius: 24, bg: service.color, child: Icon)
      ├── SizedBox (12)
      ├── Column (crossAxis: start, expanded)
      │   ├── Text (name, Body Large, Bold)
      │   └── Text ("{duration} min • R$ {price}", Body Small, Gray)
      └── Icon (Icons.chevron_right, Gray)
```

### 3. `AppointmentCard`
```
Container (margin: 12 20, padding: 16, radius: 16, bg: White, elevation: 1)
  └── Row
      ├── Container (width: 4, height: 50, radius: 2, bg: service.color)
      ├── SizedBox (12)
      ├── Expanded
      │   └── Column (crossAxis: start)
      │       ├── Text (clientName, Body Large, Bold)
      │       ├── Text ("{serviceName} • {time}", Body Medium, Gray)
      │       └── Text (phone, Body Small, Gray)
      └── PopupMenuButton (ações)
```

---

## 🔗 Navegação Completa

```
PÚBLICO (sem login):
  /book/{slug}              → booking_page
  /book/{slug}/success      → booking_success

AUTENTICADO:
  /onboarding               → onboarding_step1
  /onboarding/services      → onboarding_step2
  /onboarding/schedule      → onboarding_step3
  /onboarding/success       → onboarding_success
  /dashboard                → dashboard
  /dashboard/add            → add_appointment
  /profile                  → profile_page (configurações)
```

---

## 📱 Fluxo do Usuário (Vertical Slice)

```
[LANDING PAGE]
    ↓ Clica "Criar meu link grátis"
[ONBOARDING STEP 1] (30s)
    ↓ Preenche nome, e-mail, WhatsApp, nome do negócio
[ONBOARDING STEP 2] (30s)
    ↓ Seleciona serviços (corte, barba, etc.)
[ONBOARDING STEP 3] (30s)
    ↓ Define horários de trabalho
[ONBOARDING SUCCESS] (10s)
    ↓ Recebe link: agendafacil.pro/carlos-barbearia
    ↓ Compartilha no WhatsApp/Instagram

[CLIENTE ACESSA O LINK]
    ↓ Escolhe serviço
    ↓ Escolhe data
    ↓ Escolhe horário
    ↓ Preenche nome, WhatsApp, e-mail
    ↓ Confirma
[BOOKING SUCCESS]
    ↓ Cliente recebe confirmação WhatsApp
    ↓ Profissional recebe alerta WhatsApp

[PROFISSIONAL ABRE O PAINEL]
    ↓ Vê agendamento do dia
    ↓ Confirma, conclui ou cancela
```

**Tempo total do cadastro ao primeiro agendamento: < 2 minutos**
