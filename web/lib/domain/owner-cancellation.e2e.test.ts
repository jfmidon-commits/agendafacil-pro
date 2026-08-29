import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
let userId = "";
let serviceId = "";
let appointmentId = "";

async function waitForProfile(id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id`, { headers });
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Trigger handle_new_user não criou o profile a tempo.");
}

describeE2E("E2E Staging — Owner Cancellation", () => {
  beforeAll(async () => {
    const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: `owner-cancel-${TEST_ID.slice(0, 8)}@example.com`,
        password: `E2E-${TEST_ID}-Aa1!`,
        email_confirm: true,
        user_metadata: { name: "Owner Cancel E2E" },
      }),
    });
    if (!createUser.ok) throw new Error(`Falha ao criar usuário: ${await createUser.text()}`);
    userId = (await createUser.json()).id;
    await waitForProfile(userId);

    const serviceResponse = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        name: "Corte Owner Cancel",
        duration_minutes: 30,
        price_cents: 3500,
        buffer_before: 0,
        buffer_after: 0,
        active: true,
      }),
    });
    if (!serviceResponse.ok) throw new Error(await serviceResponse.text());
    serviceId = (await serviceResponse.json())[0].id;

    const starts = new Date(Date.now() + 48 * 60 * 60 * 1000);
    starts.setUTCMinutes(0, 0, 0);
    const ends = new Date(starts.getTime() + 30 * 60_000);
    const appointmentResponse = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        service_id: serviceId,
        service_name_snapshot: "Corte Owner Cancel",
        service_duration_minutes: 30,
        buffer_before: 0,
        buffer_after: 0,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        timezone: "America/Sao_Paulo",
        client_name: "Cliente Owner Cancel",
        client_phone: "51999999999",
        status: "confirmed",
      }),
    });
    if (!appointmentResponse.ok) throw new Error(await appointmentResponse.text());
    appointmentId = (await appointmentResponse.json())[0].id;
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}`, { method: "DELETE", headers });
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers });
  }, 30_000);

  it("cancela pelo dono, registra autoria e gera um único evento", async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cancel_appointment_by_owner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_appointment_id: appointmentId, p_user_id: userId }),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toHaveLength(1);
    expect(result[0].appointment_id).toBe(appointmentId);
    expect(result[0].integration_event_id).toBeTruthy();

    const appointmentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?id=eq.${appointmentId}&select=status,cancelled_by,cancelled_at`,
      { headers },
    );
    const appointments = await appointmentResponse.json();
    expect(appointments).toHaveLength(1);
    expect(appointments[0].status).toBe("cancelled");
    expect(appointments[0].cancelled_by).toBe("owner");
    expect(appointments[0].cancelled_at).toBeTruthy();

    const eventsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_events?appointment_id=eq.${appointmentId}&event_type=eq.appointment.cancelled&select=id`,
      { headers },
    );
    const events = await eventsResponse.json();
    expect(events).toHaveLength(1);
  });

  it("rejeita um segundo cancelamento do mesmo agendamento", async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cancel_appointment_by_owner`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_appointment_id: appointmentId, p_user_id: userId }),
    });
    expect(response.ok).toBe(false);
    expect(await response.text()).toContain("appointment_not_active");
  });
});
