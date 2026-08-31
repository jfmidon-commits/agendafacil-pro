import { describe, expect, it } from "vitest";
import { buildWhatsAppPayload, normalizePhoneE164 } from "./whatsapp-payload";

describe("normalizePhoneE164", () => {
  it("normaliza números brasileiros locais", () => {
    expect(normalizePhoneE164("(51) 99999-9999")).toBe("+5551999999999");
    expect(normalizePhoneE164("51 3333-4444")).toBe("+555133334444");
  });

  it("preserva números já em E.164", () => {
    expect(normalizePhoneE164("+55 51 99999-9999")).toBe("+5551999999999");
    expect(normalizePhoneE164("005551999999999")).toBe("+5551999999999");
  });

  it("rejeita entrada vazia ou curta demais", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("1234")).toBeNull();
  });
});

const baseInput = {
  eventType: "appointment.created",
  startsAt: "2026-09-01T13:00:00Z",
  timezone: "America/Sao_Paulo",
  service: "Corte",
  clientName: "João",
  clientPhone: "(51) 99999-9999",
  professionalName: "Maria",
  professionalPhone: "51 98888-7777",
  businessName: "Studio Maria",
  cancelUrl: "https://agendafacil-staging-pearl.vercel.app/cancel/token",
  dashboardUrl: "https://agendafacil-staging-pearl.vercel.app/dashboard",
};

describe("buildWhatsAppPayload", () => {
  it("prepara confirmação para cliente e aviso para profissional", () => {
    const payload = buildWhatsAppPayload(baseInput);

    expect(payload.client?.to).toBe("+5551999999999");
    expect(payload.client?.message).toContain("Agendamento confirmado");
    expect(payload.client?.message).toContain("01/09/2026");
    expect(payload.client?.message).toContain("10:00");
    expect(payload.client?.message).toContain(baseInput.cancelUrl);

    expect(payload.professional?.to).toBe("+5551988887777");
    expect(payload.professional?.message).toContain("Novo agendamento");
    expect(payload.professional?.message).toContain("João");
    expect(payload.professional?.message).toContain(baseInput.dashboardUrl);
  });

  it("prepara lembrete somente para o cliente", () => {
    const payload = buildWhatsAppPayload({
      ...baseInput,
      eventType: "appointment.reminder_due",
    });

    expect(payload.client?.to).toBe("+5551999999999");
    expect(payload.client?.message).toContain("Lembrete de agendamento");
    expect(payload.client?.message).toContain("Studio Maria");
    expect(payload.professional).toBeNull();
  });

  it("não cria mensagens para eventos ainda não suportados", () => {
    const payload = buildWhatsAppPayload({
      ...baseInput,
      eventType: "appointment.cancelled",
    });

    expect(payload).toEqual({ client: null, professional: null });
  });
});
