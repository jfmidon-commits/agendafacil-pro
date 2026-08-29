export type PublicSchedulingError = {
  code: string;
  message: string;
  status: number;
};

const mappings: PublicSchedulingError[] = [
  { code: "profile_not_found", message: "Profissional não encontrado.", status: 404 },
  { code: "service_not_found", message: "Serviço indisponível.", status: 404 },
  { code: "slot_unavailable", message: "Esse horário acabou de ser reservado. Escolha outro.", status: 409 },
  { code: "slot_not_aligned", message: "Esse horário não corresponde à grade disponível. Escolha um horário exibido na agenda.", status: 409 },
  { code: "schedule_block_conflict", message: "Horário indisponível.", status: 409 },
  { code: "outside_availability", message: "Horário fora da agenda do profissional.", status: 409 },
  { code: "booking_crosses_day_boundary", message: "Esse horário não pode ser reservado.", status: 409 },
  { code: "start_must_be_in_future", message: "Escolha um horário futuro.", status: 409 },
  { code: "free_plan_limit_reached", message: "Este profissional atingiu o limite mensal do plano Free.", status: 409 },
  { code: "invalid_client_name", message: "Informe um nome válido.", status: 400 },
  { code: "invalid_client_phone", message: "Informe um WhatsApp válido.", status: 400 },
  { code: "invalid_client_email", message: "Informe um e-mail válido.", status: 400 },
  { code: "invalid_notes", message: "A observação é muito longa.", status: 400 },
  { code: "appointment_not_found", message: "Agendamento não encontrado.", status: 404 },
  { code: "appointment_not_active", message: "Este agendamento não está mais ativo.", status: 409 },
  { code: "appointment_already_started", message: "O horário do agendamento já começou.", status: 409 },
];

export function mapPublicSchedulingError(
  rawMessage: string,
  fallback = "Não foi possível concluir a operação.",
): PublicSchedulingError {
  const known = mappings.find(({ code }) => rawMessage.includes(code));
  return known ?? { code: "unknown", message: fallback, status: 500 };
}
