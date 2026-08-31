type WhatsAppMessageInput = {
  eventType: string;
  startsAt: string;
  timezone: string;
  service: string;
  clientName: string;
  clientPhone: string;
  professionalName: string;
  professionalPhone: string;
  businessName: string;
  cancelUrl: string | null;
  dashboardUrl: string;
};

export type WhatsAppTarget = {
  to: string | null;
  message: string;
};

export type WhatsAppPayload = {
  client: WhatsAppTarget | null;
  professional: WhatsAppTarget | null;
};

export function normalizePhoneE164(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function formatLocalDateTime(startsAt: string, timezone: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return { date: startsAt, time: "" };
  }

  const resolvedTimezone = timezone || "America/Sao_Paulo";
  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      timeZone: resolvedTimezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: resolvedTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function locationLabel(input: WhatsAppMessageInput) {
  return input.businessName || input.professionalName || "seu atendimento";
}

function clientConfirmation(input: WhatsAppMessageInput) {
  const when = formatLocalDateTime(input.startsAt, input.timezone);
  const cancellation = input.cancelUrl
    ? `\n\nPara cancelar, acesse: ${input.cancelUrl}`
    : "";

  return [
    "✅ *Agendamento confirmado!*",
    "",
    `Olá ${input.clientName || ""}!`.trim(),
    "",
    `📅 Data: ${when.date}`,
    `⏰ Horário: ${when.time}`,
    `💈 Serviço: ${input.service}`,
    `📍 ${locationLabel(input)}`,
    "",
    "⏰ Você receberá um lembrete aproximadamente um dia antes.",
  ].join("\n") + cancellation;
}

function professionalNewAppointment(input: WhatsAppMessageInput) {
  const when = formatLocalDateTime(input.startsAt, input.timezone);
  const clientPhone = normalizePhoneE164(input.clientPhone) || input.clientPhone;

  return [
    "🆕 *Novo agendamento!*",
    "",
    `Cliente: ${input.clientName}`,
    `Serviço: ${input.service}`,
    `Data: ${when.date} às ${when.time}`,
    `📱 ${clientPhone}`,
    "",
    `Acesse seu painel: ${input.dashboardUrl}`,
  ].join("\n");
}

function clientReminder(input: WhatsAppMessageInput) {
  const when = formatLocalDateTime(input.startsAt, input.timezone);

  return [
    "⏰ *Lembrete de agendamento*",
    "",
    `Olá ${input.clientName || ""}!`.trim(),
    "",
    "Passando para lembrar que você tem um agendamento próximo:",
    "",
    `📅 ${when.date}`,
    `⏰ ${when.time}`,
    `💈 ${input.service}`,
    `📍 ${locationLabel(input)}`,
    "",
    "Nos vemos lá! 😊",
  ].join("\n");
}

export function buildWhatsAppPayload(input: WhatsAppMessageInput): WhatsAppPayload {
  const clientTo = normalizePhoneE164(input.clientPhone);
  const professionalTo = normalizePhoneE164(input.professionalPhone);

  if (input.eventType === "appointment.reminder_due") {
    return {
      client: {
        to: clientTo,
        message: clientReminder(input),
      },
      professional: null,
    };
  }

  if (input.eventType === "appointment.created" || input.eventType === "appointment.confirmed") {
    return {
      client: {
        to: clientTo,
        message: clientConfirmation(input),
      },
      professional: {
        to: professionalTo,
        message: professionalNewAppointment(input),
      },
    };
  }

  return { client: null, professional: null };
}
