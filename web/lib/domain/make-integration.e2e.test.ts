import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliverIntegrationEvent } from "../integrations/make";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";
const MAKE_APPOINTMENT_WEBHOOK_URL = process.env.MAKE_APPOINTMENT_WEBHOOK_URL || "";
const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const SAFE_TARGET = STAGING_URL.includes("staging") || STAGING_URL.includes("localhost");
const MAKE_CONFIGURED = Boolean(MAKE_APPOINTMENT_WEBHOOK_URL);
const describeMake = RUN_STAGING_E2E && MAKE_CONFIGURED ? describe : describe.skip;

if (RUN_STAGING_E2E && (!SUPABASE_URL || !SERVICE_KEY || !STAGING_URL)) {
  throw new Error("RUN_STAGING_E2E=1 exige URL e credenciais de staging.");
}
if (RUN_STAGING_E2E && !SAFE_TARGET) {
  throw new Error(`E2E destrutivo bloqueado fora de staging/localhost: ${STAGING_URL}`);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const TIMEZONE = "America/Sao_Paulo";
const TEST_ID = crypto.randomUUID();
const TEST_EMAIL = `make-e2e-${TEST_ID.slice(0, 8)}@agendafacil.test`;
const TEST_SLUG = `make-e2e-${TEST_ID.slice(0, 8)}`;

let userId = "";
let serviceId = "";
let appointmentId = "";

type Slot = { starts_at: string; ends_at: string; label: string; timezone: string };
type IntegrationEvent = {
  id: string;
  delivered_at: string | null;
  attempts: number;
  last_error: string | null;
};

async function waitForProfile(id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id`, { headers });
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Trigger handle_new_user não criou o profile a tempo.");
}

function localDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function tomorrowInTimezone() {
  return localDate(new Date(Date.now() + 24 * 60 * 60 * 1000), TIMEZONE);
}

async function getEvent(eventType: string) {
  const query = new URLSearchParams({
    appointment_id: `eq.${appointmentId}`,
    event_type: `eq.${eventType}`,
    select: "id,delivered_at,attempts,last_error",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/integration_events?${query}`, { headers });
  if (!response.ok) throw new Error(`Falha ao ler integration_event: ${await response.text()}`);
  const rows = (await response.json()) as IntegrationEvent[];
  return rows[0] || null;
}

async function waitForDelivered(eventType: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let latest: IntegrationEvent | null = null;
  while (Date.now() < deadline) {
    latest = await getEvent(eventType);
    if (latest?.delivered_at) return latest;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Make não confirmou ${eventType}. Estado: ${JSON.stringify({
      attempts: latest?.attempts,
      lastError: latest?.last_error,
      delivered: Boolean(latest?.delivered_at),
    })}`,
  );
}

describeMake("E2E Staging — Make webhook", () => {
  beforeAll(async () => {
    const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: `E2E-${TEST_ID}-Aa1!`,
        email_confirm: true,
        user_metadata: { name: "Profissional Make E2E", phone: "51999999999" },
      }),
    });
    if (!createUser.ok) throw new Error(`Falha ao criar usuário: ${await createUser.text()}`);
    const user = await createUser.json();
    userId = user.id;
    await waitForProfile(userId);

    const profileUpdate = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ timezone: TIMEZONE, phone: "51999999999" }),
    });
    if (!profileUpdate.ok) throw new Error(`Falha ao atualizar profile: ${await profileUpdate.text()}`);

    const publicProfile = await fetch(`${SUPABASE_URL}/rest/v1/public_profiles`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: userId,
        business_name: "AgendaFácil Make E2E",
        slug: TEST_SLUG,
        description: "Cenário temporário para validar webhooks Make",
        active: true,
      }),
    });
    if (!publicProfile.ok) throw new Error(`Falha ao criar perfil público: ${await publicProfile.text()}`);

    const service = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        name: "Serviço Make E2E",
        duration_minutes: 30,
        price_cents: 100,
        buffer_before: 0,
        buffer_after: 0,
        active: true,
      }),
    });
    if (!service.ok) throw new Error(`Falha ao criar serviço: ${await service.text()}`);
    const serviceRows = (await service.json()) as { id: string }[];
    serviceId = serviceRows[0].id;

    const availability = Array.from({ length: 7 }, (_, day) => ({
      user_id: userId,
      day_of_week: day,
      start_time: "18:00",
      end_time: "20:00",
      slot_interval_minutes: 30,
      active: true,
    }));
    const availabilityResponse = await fetch(`${SUPABASE_URL}/rest/v1/availability_rules`, {
      method: "POST",
      headers,
      body: JSON.stringify(availability),
    });
    if (!availabilityResponse.ok) {
      throw new Error(`Falha ao criar disponibilidade: ${await availabilityResponse.text()}`);
    }
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}`, {
      method: "DELETE",
      headers,
    });
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers,
    });
  }, 30_000);

  it("entrega confirmação e lembrete ao Make usando o payload real", async () => {
    const date = tomorrowInTimezone();
    const availabilityResponse = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${date}`,
    );
    expect(availabilityResponse.status).toBe(200);
    const availability = (await availabilityResponse.json()) as { slots?: Slot[] };
    const target = (availability.slots || []).find((slot) => slot.label === "18:00");
    expect(target).toBeTruthy();

    const booking = await fetch(`${STAGING_URL}/api/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: TEST_SLUG,
        serviceId,
        startsAt: target!.starts_at,
        clientName: "Cliente Make E2E",
        clientPhone: "51988888888",
        clientEmail: "make-e2e-client@example.com",
        notes: "Payload sintético de staging",
      }),
    });
    expect(booking.status).toBe(201);
    const booked = (await booking.json()) as { appointmentId: string };
    appointmentId = booked.appointmentId;
    expect(appointmentId).toBeTruthy();

    // /api/book faz a primeira tentativa de entrega no runtime real do staging.
    const confirmation = await waitForDelivered("appointment.created");
    expect(confirmation.attempts).toBeGreaterThan(0);
    expect(confirmation.last_error).toBeNull();

    const reminderCreate = await fetch(`${SUPABASE_URL}/rest/v1/integration_events`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        appointment_id: appointmentId,
        event_type: "appointment.reminder_due",
      }),
    });
    if (!reminderCreate.ok) {
      throw new Error(`Falha ao criar reminder event: ${await reminderCreate.text()}`);
    }
    const reminderRows = (await reminderCreate.json()) as { id: string }[];
    const reminderEventId = reminderRows[0].id;

    // Valida o segundo tipo de payload contra o webhook real; a função usa
    // MAKE_REMINDER_WEBHOOK_URL quando presente e o appointment webhook como fallback.
    expect(await deliverIntegrationEvent(reminderEventId)).toBe(true);
    const reminder = await waitForDelivered("appointment.reminder_due", 5_000);
    expect(reminder.attempts).toBeGreaterThan(0);
    expect(reminder.last_error).toBeNull();
  }, 45_000);
});
