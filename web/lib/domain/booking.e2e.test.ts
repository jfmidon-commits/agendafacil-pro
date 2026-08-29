import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * E2E destrutivo de staging — fluxo público de agendamento.
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

type Slot = { starts_at: string; ends_at: string; label: string; timezone: string };
type ApiError = { error?: string; code?: string };

let userId = "";
let serviceId = "";
let bookedStartsAt = "";
let cancelToken = "";

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

async function getSlots(date = tomorrowDate()) {
  const response = await fetch(
    `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${date}`,
  );
  const data = (await response.json()) as { slots?: Slot[] } & ApiError;
  return { response, data, slots: data.slots || [] };
}

function bookingPayload(startsAt: string) {
  return {
    slug: TEST_SLUG,
    serviceId,
    startsAt,
    clientName: "Cliente Teste",
    clientPhone: "51988888888",
    clientEmail: "cliente-e2e@example.com",
  };
}

async function postBooking(startsAt: string) {
  return fetch(`${STAGING_URL}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingPayload(startsAt)),
  });
}

describeE2E("E2E Staging — Public Booking Hardening", () => {
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

  it("mostra estado amigável para slug inexistente", async () => {
    const response = await fetch(`${STAGING_URL}/barbearia-inexistente-${TEST_ID.slice(0, 8)}`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Link de agendamento indisponível");
  });

  it("não vaza erro interno para perfil ou serviço inexistente", async () => {
    const invalidSlugResponse = await fetch(
      `${STAGING_URL}/api/availability?slug=slug-inexistente&serviceId=${serviceId}&date=${tomorrowDate()}`,
    );
    expect(invalidSlugResponse.status).toBe(404);
    const invalidSlug = (await invalidSlugResponse.json()) as ApiError;
    expect(invalidSlug.code).toBe("profile_not_found");
    expect(invalidSlug.error).toBe("Profissional não encontrado.");

    const invalidServiceResponse = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${crypto.randomUUID()}&date=${tomorrowDate()}`,
    );
    expect(invalidServiceResponse.status).toBe(404);
    const invalidService = (await invalidServiceResponse.json()) as ApiError;
    expect(invalidService.code).toBe("service_not_found");
  });

  it("retorna apenas slots válidos", async () => {
    const { response, slots } = await getSlots();
    expect(response.status).toBe(200);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].starts_at).toBeTruthy();
  });

  it("rejeita horário dentro da janela mas fora da grade", async () => {
    const { slots } = await getSlots();
    const validStart = slots[0].starts_at;
    const misaligned = new Date(new Date(validStart).getTime() + 7 * 60_000).toISOString();
    const response = await postBooking(misaligned);
    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiError;
    expect(body.code).toBe("slot_not_aligned");
  });

  it("respeita bloqueio de agenda na listagem e na reserva direta", async () => {
    const { slots } = await getSlots();
    const target = slots[0];
    const blockResponse = await fetch(`${SUPABASE_URL}/rest/v1/schedule_blocks`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        starts_at: target.starts_at,
        ends_at: target.ends_at,
        type: "blocked",
        reason: "E2E",
      }),
    });
    if (!blockResponse.ok) throw new Error(await blockResponse.text());
    const blocks = (await blockResponse.json()) as { id: string }[];

    try {
      const afterBlock = await getSlots();
      expect(afterBlock.slots.some((slot) => slot.starts_at === target.starts_at)).toBe(false);

      const direct = await postBooking(target.starts_at);
      expect(direct.status).toBe(409);
      const body = (await direct.json()) as ApiError;
      expect(body.code).toBe("schedule_block_conflict");
    } finally {
      await fetch(`${SUPABASE_URL}/rest/v1/schedule_blocks?id=eq.${blocks[0].id}`, {
        method: "DELETE",
        headers,
      });
    }
  });

  it("permite exatamente uma reserva concorrente (201 + 409)", async () => {
    const { slots } = await getSlots();
    bookedStartsAt = slots[0].starts_at;

    const [first, second] = await Promise.all([
      postBooking(bookedStartsAt),
      postBooking(bookedStartsAt),
    ]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);
    const successful = first.status === 201 ? first : second;
    const successBody = (await successful.json()) as { cancelUrl?: string };
    expect(successBody.cancelUrl).toBeTruthy();
    cancelToken = new URL(successBody.cancelUrl as string).pathname.split("/cancel/")[1];
    expect(cancelToken).toBeTruthy();

    const databaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}&select=id,status,starts_at`,
      { headers },
    );
    const appointments = await databaseResponse.json();
    expect(appointments).toHaveLength(1);

    const after = await getSlots();
    expect(after.slots.some((slot) => slot.starts_at === bookedStartsAt)).toBe(false);
  }, 15_000);

  it("cancela atomicamente e libera o slot (200 + 409)", async () => {
    const request = () => fetch(`${STAGING_URL}/api/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: cancelToken }),
    });

    const [first, second] = await Promise.all([request(), request()]);
    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([200, 409]);

    const databaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}&select=id,status,cancelled_by`,
      { headers },
    );
    const appointments = await databaseResponse.json();
    expect(appointments).toHaveLength(1);
    expect(appointments[0].status).toBe("cancelled");
    expect(appointments[0].cancelled_by).toBe("client");

    const afterCancel = await getSlots();
    expect(afterCancel.slots.some((slot) => slot.starts_at === bookedStartsAt)).toBe(true);
  }, 15_000);

  it("trata serviço inativo como indisponível", async () => {
    await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${serviceId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: false }),
    });

    try {
      const availability = await getSlots();
      expect(availability.response.status).toBe(404);
      expect(availability.data.code).toBe("service_not_found");

      const page = await fetch(`${STAGING_URL}/${TEST_SLUG}`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Nenhum serviço disponível");
    } finally {
      await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${serviceId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ active: true }),
      });
    }
  });

  it("aplica limite mensal do plano Free", async () => {
    const profileUpdate = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ trial_status: "ended", trial_ends_at: null }),
    });
    expect(profileUpdate.ok).toBe(true);

    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}&select=id`,
      { headers },
    );
    const existing = (await existingResponse.json()) as { id: string }[];
    const missing = Math.max(0, 10 - existing.length);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(3, 0, 0, 0);
    const startsAt = monthStart.toISOString();
    const endsAt = new Date(monthStart.getTime() + 30 * 60_000).toISOString();

    if (missing > 0) {
      const fillers = Array.from({ length: missing }, (_, index) => ({
        user_id: userId,
        service_id: serviceId,
        service_name_snapshot: "Corte",
        service_duration_minutes: 30,
        buffer_before: 0,
        buffer_after: 0,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: "America/Sao_Paulo",
        client_name: `Quota ${index + 1}`,
        client_phone: "51977777777",
        status: "completed",
      }));
      const insert = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify(fillers),
      });
      if (!insert.ok) throw new Error(`Falha ao preparar quota: ${await insert.text()}`);
    }

    const { slots } = await getSlots();
    const response = await postBooking(slots[0].starts_at);
    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiError;
    expect(body.code).toBe("free_plan_limit_reached");
    expect(body.error).toContain("limite mensal do plano Free");
  }, 15_000);
});
