import { describe, expect, it, beforeAll, afterAll } from "vitest";

/**
 * E2E Staging Test — Double Booking Prevention
 * 
 * Este teste:
 * 1. Cria um profissional temporário no Supabase
 * 2. Configura serviço e disponibilidade
 * 3. Consulta slots disponíveis
 * 4. Dispara duas reservas concorrentes
 * 5. Valida que apenas uma succeede (201 vs 409)
 * 6. Limpa todos os dados criados
 * 
 * ⚠️  Só roda em staging. Nunca em produção.
 */

// Configuração
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL!;

// Helpers
async function supabaseQuery(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  return res;
}

async function supabaseRpc(functionName: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  return res;
}

// Gerar dados únicos para cada execução
const TEST_ID = crypto.randomUUID();
const TEST_EMAIL = `e2e-${TEST_ID.slice(0, 8)}@agendafacil.test`;
const TEST_SLUG = `barbearia-e2e-${TEST_ID.slice(0, 8)}`;
const TEST_PHONE = "(51) 99999-9999";

let userId: string;
let serviceId: string;
let profileId: string;

describe("E2E Staging — Double Booking", () => {
  beforeAll(async () => {
    // Verificar ambiente
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Credenciais de staging não configuradas. Pule este teste.");
    }
    if (!STAGING_URL.includes("staging") && !STAGING_URL.includes("localhost")) {
      throw new Error("E2E só roda em staging. URL detectada: " + STAGING_URL);
    }

    // 1. Criar usuário no auth
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { name: "Barbeiro E2E" },
      }),
    });

    if (!createUserRes.ok) {
      throw new Error(`Falha ao criar usuário: ${await createUserRes.text()}`);
    }

    const userData = await createUserRes.json();
    userId = userData.id;

    // Aguardar trigger handle_new_user
    await new Promise((r) => setTimeout(r, 500));

    // 2. Criar public_profile
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/public_profiles`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        business_name: "Barbearia E2E Test",
        slug: TEST_SLUG,
        description: "Barbearia criada automaticamente para teste E2E",
        phone: TEST_PHONE,
        whatsapp: "51999999999",
      }),
    });

    if (!profileRes.ok) {
      throw new Error(`Falha ao criar public_profile: ${await profileRes.text()}`);
    }
    const profileData = await profileRes.json();
    profileId = profileData[0].id;

    // 3. Criar serviço: Corte — 30min — R$35
    const serviceRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        name: "Corte",
        description: "Corte de cabelo masculino com acabamento perfeito",
        duration_minutes: 30,
        price_cents: 3500,
        color: "#8B5CF6",
      }),
    });

    if (!serviceRes.ok) {
      throw new Error(`Falha ao criar serviço: ${await serviceRes.text()}`);
    }
    const serviceData = await serviceRes.json();
    serviceId = serviceData[0].id;

    // 4. Criar disponibilidade: Seg-Sex 9h-18h
    const availabilityData = [
      { day_of_week: 1, start_time: "09:00", end_time: "18:00" },
      { day_of_week: 2, start_time: "09:00", end_time: "18:00" },
      { day_of_week: 3, start_time: "09:00", end_time: "18:00" },
      { day_of_week: 4, start_time: "09:00", end_time: "18:00" },
      { day_of_week: 5, start_time: "09:00", end_time: "18:00" },
    ];

    for (const avail of availabilityData) {
      const availRes = await fetch(`${SUPABASE_URL}/rest/v1/availability_rules`, {
        method: "POST",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          ...avail,
        }),
      });
      if (!availRes.ok) {
        console.warn(`Falha ao criar disponibilidade dia ${avail.day_of_week}`);
      }
    }

    // 5. Criar subscription pro (para não bloquear no plano free)
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        plan: "pro",
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  }, 30000);

  afterAll(async () => {
    // Limpar TODOS os dados criados
    if (!userId) return;

    // Deletar em ordem reversa (foreign keys)
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/availability_rules?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/services?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/public_profiles?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
    // Deletar usuário do auth
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
  }, 30000);

  it("deve criar profissional, serviço e disponibilidade", () => {
    expect(userId).toBeDefined();
    expect(serviceId).toBeDefined();
    expect(profileId).toBeDefined();
  });

  it("deve retornar slots disponíveis via API", async () => {
    // Pegar uma data futura (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const res = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${dateStr}`
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.slots)).toBe(true);
    expect(data.slots.length).toBeGreaterThan(0);
  });

  it("deve permitir apenas 1 reserva em slot concorrente (201 + 409)", async () => {
    // Pegar uma data futura (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    // Consultar slots
    const availRes = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${dateStr}`
    );
    const availData = await availRes.json();
    expect(availData.slots.length).toBeGreaterThan(0);

    // Pegar o primeiro slot
    const slot = availData.slots[0];
    const startsAt = slot; // já vem no formato ISO

    // Preparar payload
    const payload = {
      slug: TEST_SLUG,
      serviceId: serviceId,
      startsAt: startsAt,
      clientName: "Cliente Teste",
      clientPhone: "(51) 98888-8888",
      clientEmail: "teste@email.com",
    };

    // Disparar DUAS requisições SIMULTÂNEAS
    const [res1, res2] = await Promise.all([
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

    // 8. Validar: uma 201, outra 409
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // 9. Verificar no banco: exatamente 1 appointment
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?user_id=eq.${userId}&select=*`,
      {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    const appointments = await dbRes.json();
    expect(appointments.length).toBe(1);

    // 10. Verificar que o slot desapareceu da disponibilidade
    const availRes2 = await fetch(
      `${STAGING_URL}/api/availability?slug=${TEST_SLUG}&serviceId=${serviceId}&date=${dateStr}`
    );
    const availData2 = await availRes2.json();
    const slotStillAvailable = availData2.slots.includes(startsAt);
    expect(slotStillAvailable).toBe(false);
  }, 15000);
});
