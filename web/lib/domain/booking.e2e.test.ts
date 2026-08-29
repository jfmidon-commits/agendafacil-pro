import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * E2E de staging — prevenção de double booking.
 *
 * O CI comum NÃO executa este teste. Para rodar intencionalmente:
 * RUN_STAGING_E2E=1 + credenciais de staging.
 * A URL é bloqueada se não parecer staging/localhost.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";
const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const SAFE_TARGET = STAGING_URL.includes("staging") || STAGING_URL.includes("localhost");

if (RUN_STAGING_E2E && (!SUPABASE_URL || !SERVICE_KEY || !STAGING_URL)) {
  throw new Error("RUN_STAGING_E2E=1 exige URL e credenciais de staging.");
}
if (RUN_STAGING_E2E && !SAFE_TARGET) {
  throw new Error(`E2E destrutivo bloqueado fora de staging/localhost: ${STAGING_URL}`);
}

const describeE2E = RUN_STAGING_E2E ? describe : describe.skip;
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const TEST_ID = crypto.randomUUID();
const TEST_EMAIL = `e2e-${TEST_ID.slice(0, 8)}@agendafacil.test`;
const TEST_SLUG = `barbearia-e2e-${TEST_ID.slice(0, 8)}`;

let userId = "";
let serviceId = "";

async function waitForProfile(id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id`, { headers });
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Trigger handle_new_user não criou o profile a tempo.");
}

function tomorrowDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describeE2E("E2E Staging — Double Booking", () => {
  beforeAll(async () => {
    const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: `E2E-${TEST_ID}-Aa1!`,
        email_confirm: true,
        user_metadata: { name: "Barbeiro E2E" },
      }),
    });
    if (!createUser.ok) throw new Error(`Falha ao criar usuário: ${await createUser.text()}`);
    const user = await createUser.json();
    userId = user.id;
    await waitForProfile(userId);

    const publicProfile = await fetch(`${SUPABASE_URL}/rest/v1/public_profiles`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        business_name: "Barbearia E2E Test",
        slug: TEST_SLUG,
        description: "Criada automaticamente para o E2E de staging",
        active: true,
      }),
    });
    if (!publicProfile.ok) throw new Error(`Falha ao criar perfil público: ${await publicProfile.text()}`);

    const service = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        name: "Corte",
        duration_minutes: 30,
        price_cents: 3500,
        buffer_before: 0,
        buffer_after: 0,
        active: true,
      }),
    });
    if (!service.ok) throw new Error(`Falha ao criar serviço: ${await service.text()}`);
    const serviceRows = await service.json();
    serviceId = serviceRows[0].id;

    const availability = Array.from({ length: 7 }, (_, day) => ({
      user_id: userId,
      day_of_week: day,
      start_time: "09:00",
      end_time: "12:00",
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

    await fetch(`${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}`, { method: "DELETE", headers });
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers });
  }, 30_000);

  it("cria o cenário temporário", () => {
    expect(userId).toBeTruthy();
    expect(serviceId).toBeTruthy();
  });

  it("retorna slots disponíveis via API", async () => {
    const response = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${tomorrowDate()}`,
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.slots)).toBe(true);
    expect(data.slots.length).toBeGreaterThan(0);
    expect(data.slots[0].starts_at).toBeTruthy();
  });

  it("permite exatamente uma reserva concorrente (201 + 409)", async () => {
    const date = tomorrowDate();
    const availability = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${date}`,
    );
    const availabilityData = await availability.json();
    const startsAt = availabilityData.slots?.[0]?.starts_at;
    expect(startsAt).toBeTruthy();

    const payload = {
      slug: TEST_SLUG,
      serviceId,
      startsAt,
      clientName: "Cliente Teste",
      clientPhone: "51988888888",
      clientEmail: "cliente-e2e@example.com",
    };

    const [first, second] = await Promise.all([
      fetch(`${STAGING_URL}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      fetch(`${STAGING_URL}/api/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);

    const databaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}&select=id,starts_at`,
      { headers },
    );
    const appointments = await databaseResponse.json();
    expect(appointments).toHaveLength(1);

    const availabilityAfter = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${date}`,
    );
    const afterData = await availabilityAfter.json();
    expect(afterData.slots.some((slot: { starts_at: string }) => slot.starts_at === startsAt)).toBe(false);
  }, 15_000);
});
