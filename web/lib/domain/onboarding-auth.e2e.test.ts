import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";
const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const SAFE_TARGET = STAGING_URL.includes("staging") || STAGING_URL.includes("localhost");

if (RUN_STAGING_E2E && (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !STAGING_URL)) {
  throw new Error("RUN_STAGING_E2E=1 exige URLs e credenciais públicas/administrativas de staging.");
}
if (RUN_STAGING_E2E && !SAFE_TARGET) {
  throw new Error(`E2E destrutivo bloqueado fora de staging/localhost: ${STAGING_URL}`);
}

const describeE2E = RUN_STAGING_E2E ? describe : describe.skip;
const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const TEST_ID = crypto.randomUUID();
const EMAIL = `onboarding-${TEST_ID.slice(0, 8)}@agendafacil.test`;
const PASSWORD = `E2E-${TEST_ID}-Aa1!`;
const INITIAL_SLUG = `onboarding-e2e-${TEST_ID.slice(0, 8)}`;
const UPDATED_SLUG = `config-e2e-${TEST_ID.slice(0, 8)}`;

let userId = "";
let accessToken = "";
let serviceId = "";

function userHeaders() {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function waitForProfile(id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=id`, { headers: adminHeaders });
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

describeE2E("E2E Staging — Authenticated Onboarding", () => {
  beforeAll(async () => {
    const createUser = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: "Barbeiro Auth E2E", phone: "51988887777" },
      }),
    });
    if (!createUser.ok) throw new Error(`Falha ao criar usuário: ${await createUser.text()}`);
    userId = (await createUser.json()).id;
    await waitForProfile(userId);

    const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!login.ok) throw new Error(`Falha ao autenticar usuário E2E: ${await login.text()}`);
    accessToken = (await login.json()).access_token;
    if (!accessToken) throw new Error("Login E2E não retornou access_token.");
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: adminHeaders });
  }, 30_000);

  it("bloqueia onboarding e configurações sem sessão autenticada", async () => {
    const anonymous = { apikey: ANON_KEY, "Content-Type": "application/json" };
    const onboarding = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_onboarding_config`, {
      method: "POST",
      headers: anonymous,
      body: JSON.stringify({
        p_business_name: "Sem sessão",
        p_slug: `anon-${TEST_ID.slice(0, 8)}`,
        p_service_name: "Corte",
        p_duration_minutes: 30,
        p_price_cents: 3500,
        p_slot_interval_minutes: 30,
        p_schedule: [{ days: [1], startTime: "09:00", endTime: "12:00" }],
      }),
    });
    expect([401, 403, 404]).toContain(onboarding.status);

    const settings = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_business_settings`, {
      method: "POST",
      headers: anonymous,
      body: JSON.stringify({
        p_name: "Sem sessão",
        p_phone: "51999999999",
        p_business_name: "Sem sessão",
        p_slug: `anon-config-${TEST_ID.slice(0, 8)}`,
        p_description: "",
        p_city: "Viamão - RS",
      }),
    });
    expect([401, 403, 404]).toContain(settings.status);
  });

  it("salva onboarding com sessão real e cria perfil, serviço e agenda", async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_onboarding_config`, {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({
        p_business_name: "Barbearia Auth E2E",
        p_slug: INITIAL_SLUG,
        p_service_name: "Corte Autenticado",
        p_duration_minutes: 30,
        p_price_cents: 3500,
        p_slot_interval_minutes: 30,
        p_schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], startTime: "09:00", endTime: "12:00" }],
      }),
    });
    expect(response.ok).toBe(true);

    const servicesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/services?user_id=eq.${userId}&select=id,name,duration_minutes,price_cents&order=created_at.asc`,
      { headers: userHeaders() },
    );
    const services = await servicesResponse.json();
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe("Corte Autenticado");
    expect(services[0].price_cents).toBe(3500);
    serviceId = services[0].id;

    const rulesResponse = await fetch(`${SUPABASE_URL}/rest/v1/availability_rules?select=id,day_of_week,start_time,end_time`, {
      headers: userHeaders(),
    });
    const rules = await rulesResponse.json();
    expect(rules).toHaveLength(7);

    const publicPage = await fetch(`${STAGING_URL}/${INITIAL_SLUG}`);
    expect(publicPage.status).toBe(200);
    expect(await publicPage.text()).toContain("Barbearia Auth E2E");

    const availability = await fetch(
      `${STAGING_URL}/api/availability?slug=${INITIAL_SLUG}&serviceId=${serviceId}&date=${tomorrowDate()}`,
    );
    expect(availability.status).toBe(200);
    const availabilityBody = await availability.json();
    expect(availabilityBody.slots.length).toBeGreaterThan(0);
  }, 15_000);

  it("edita configurações sem destruir serviço nem horários", async () => {
    const beforeRulesResponse = await fetch(`${SUPABASE_URL}/rest/v1/availability_rules?select=id`, { headers: userHeaders() });
    const beforeRules = await beforeRulesResponse.json();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_business_settings`, {
      method: "POST",
      headers: userHeaders(),
      body: JSON.stringify({
        p_name: "Barbeiro Atualizado",
        p_phone: "(51) 99999-1234",
        p_business_name: "Barbearia Atualizada E2E",
        p_slug: UPDATED_SLUG,
        p_description: "Configuração atualizada sem alterar a agenda.",
        p_city: "Viamão - RS",
      }),
    });
    expect(response.ok).toBe(true);

    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=name,phone`, { headers: userHeaders() });
    const profiles = await profileResponse.json();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Barbeiro Atualizado");
    expect(profiles[0].phone).toBe("51999991234");

    const publicProfileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/public_profiles?user_id=eq.${userId}&select=business_name,slug,description,city`,
      { headers: userHeaders() },
    );
    const publicProfiles = await publicProfileResponse.json();
    expect(publicProfiles).toHaveLength(1);
    expect(publicProfiles[0].slug).toBe(UPDATED_SLUG);
    expect(publicProfiles[0].city).toBe("Viamão - RS");

    const afterRulesResponse = await fetch(`${SUPABASE_URL}/rest/v1/availability_rules?select=id`, { headers: userHeaders() });
    const afterRules = await afterRulesResponse.json();
    expect(afterRules.map((row: { id: string }) => row.id).sort()).toEqual(
      beforeRules.map((row: { id: string }) => row.id).sort(),
    );

    const servicesResponse = await fetch(`${SUPABASE_URL}/rest/v1/services?user_id=eq.${userId}&select=id,name,price_cents`, { headers: userHeaders() });
    const services = await servicesResponse.json();
    expect(services).toHaveLength(1);
    expect(services[0].id).toBe(serviceId);
    expect(services[0].name).toBe("Corte Autenticado");
    expect(services[0].price_cents).toBe(3500);

    const newPage = await fetch(`${STAGING_URL}/${UPDATED_SLUG}`);
    expect(newPage.status).toBe(200);
    const html = await newPage.text();
    expect(html).toContain("Barbearia Atualizada E2E");
    expect(html).toContain("Viamão - RS");
  }, 15_000);
});
