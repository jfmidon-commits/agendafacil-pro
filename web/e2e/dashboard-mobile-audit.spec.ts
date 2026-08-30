import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the staging UI E2E.`);
  return value;
}

function assertSafeTarget() {
  const url = new URL(STAGING_URL);
  const host = url.hostname.toLowerCase();
  if (!host.includes("staging") && host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing destructive UI E2E against non-staging host: ${host}`);
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${STAGING_URL}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 2);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

test.describe("Dashboard de agendamentos — auditoria mobile", () => {
  test.skip(!RUN_STAGING_E2E, "RUN_STAGING_E2E não está ativo.");

  const viewports = [
    { name: "320x568", width: 320, height: 568 },
    { name: "360x800", width: 360, height: 800 },
    { name: "390x844", width: 390, height: 844 },
    { name: "412x915", width: 412, height: 915 },
  ];

  for (const viewport of viewports) {
    test(`dashboard com agendamentos em ${viewport.name}`, async ({ browser }) => {
      assertSafeTarget();

      const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
      const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const id = crypto.randomUUID().slice(0, 8);
      const email = `dashaudit-${id}@example.com`;
      const password = `E2E-${crypto.randomUUID()}-Aa1!`;
      const slug = `dashaudit-${id}`;
      const businessName = `DashAudit E2E ${id}`;
      let userId = "";

      try {
        // Criar usuário
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: "Barbeiro DashAudit", phone: "51988888888" },
        });
        if (createError || !created.user) throw createError || new Error("Failed to create user.");
        userId = created.user.id;

        // Criar perfil público
        const { error: profileError } = await admin
          .from("public_profiles")
          .insert({
            user_id: userId,
            business_name: businessName,
            slug,
            description: "Teste de auditoria mobile",
            active: true,
          });
        if (profileError) throw profileError;

        // Criar serviço — schema: duration_minutes (int), price_cents (int)
        const { data: service, error: serviceError } = await admin
          .from("services")
          .insert({
            user_id: userId,
            name: "Corte Audit",
            duration_minutes: 30,
            price_cents: 3500,
            active: true,
          })
          .select("id")
          .single();
        if (serviceError) throw serviceError;

        // Criar disponibilidade — schema: slot_interval_minutes (int, default 30)
        const { error: availError } = await admin
          .from("availability_rules")
          .insert({
            user_id: userId,
            day_of_week: new Date().getDay(),
            start_time: "00:00",
            end_time: "23:59",
            slot_interval_minutes: 30,
            active: true,
          });
        if (availError) throw availError;

        // Horário base: agora
        const now = new Date();

        // 1. Agendamento FUTURO confirmado — agora + 4 horas
        const futureConfirmed = addMinutes(now, 240);
        const endsConfirmed = addMinutes(futureConfirmed, 30);
        const { error: appt1Error } = await admin
          .from("appointments")
          .insert({
            user_id: userId,
            service_id: service.id,
            service_name_snapshot: "Corte Audit",
            service_duration_minutes: 30,
            buffer_before: 0,
            buffer_after: 0,
            starts_at: futureConfirmed.toISOString(),
            ends_at: endsConfirmed.toISOString(),
            timezone: "America/Sao_Paulo",
            client_name: "João Confirmado",
            client_phone: "51999999999",
            client_email: "joao@example.com",
            status: "confirmed",
            occupied_range: `[${futureConfirmed.toISOString()},${endsConfirmed.toISOString()})`,
          });
        if (appt1Error) throw appt1Error;

        // 2. Agendamento FUTURO cancelado — agora + 5 horas
        const futureCancelled = addMinutes(now, 300);
        const endsCancelled = addMinutes(futureCancelled, 30);
        const { error: appt2Error } = await admin
          .from("appointments")
          .insert({
            user_id: userId,
            service_id: service.id,
            service_name_snapshot: "Corte Audit",
            service_duration_minutes: 30,
            buffer_before: 0,
            buffer_after: 0,
            starts_at: futureCancelled.toISOString(),
            ends_at: endsCancelled.toISOString(),
            timezone: "America/Sao_Paulo",
            client_name: "Maria Cancelada",
            client_phone: "51988888888",
            client_email: "maria@example.com",
            status: "cancelled",
            occupied_range: `[${futureCancelled.toISOString()},${endsCancelled.toISOString()})`,
          });
        if (appt2Error) throw appt2Error;

        // 3. Agendamento RECENTE concluído — agora - 2 horas
        const recentCompleted = addMinutes(now, -120);
        const endsCompleted = addMinutes(recentCompleted, 30);
        const { error: appt3Error } = await admin
          .from("appointments")
          .insert({
            user_id: userId,
            service_id: service.id,
            service_name_snapshot: "Corte Audit",
            service_duration_minutes: 30,
            buffer_before: 0,
            buffer_after: 0,
            starts_at: recentCompleted.toISOString(),
            ends_at: endsCompleted.toISOString(),
            timezone: "America/Sao_Paulo",
            client_name: "Pedro Concluído",
            client_phone: "51977777777",
            client_email: "pedro@example.com",
            status: "completed",
            occupied_range: `[${recentCompleted.toISOString()},${endsCompleted.toISOString()})`,
          });
        if (appt3Error) throw appt3Error;

        // 4. Agendamento RECENTE no-show — agora - 3 horas
        const recentNoShow = addMinutes(now, -180);
        const endsNoShow = addMinutes(recentNoShow, 30);
        const { error: appt4Error } = await admin
          .from("appointments")
          .insert({
            user_id: userId,
            service_id: service.id,
            service_name_snapshot: "Corte Audit",
            service_duration_minutes: 30,
            buffer_before: 0,
            buffer_after: 0,
            starts_at: recentNoShow.toISOString(),
            ends_at: endsNoShow.toISOString(),
            timezone: "America/Sao_Paulo",
            client_name: "Ana No-Show",
            client_phone: "51966666666",
            client_email: "ana@example.com",
            status: "no_show",
            occupied_range: `[${recentNoShow.toISOString()},${endsNoShow.toISOString()})`,
          });
        if (appt4Error) throw appt4Error;

        // 5. Agendamento PASSADO confirmado — agora - 30 minutos (para testar botões de ação)
        const pastConfirmed = addMinutes(now, -30);
        const endsPastConfirmed = addMinutes(pastConfirmed, 30);
        const { error: appt5Error } = await admin
          .from("appointments")
          .insert({
            user_id: userId,
            service_id: service.id,
            service_name_snapshot: "Corte Audit",
            service_duration_minutes: 30,
            buffer_before: 0,
            buffer_after: 0,
            starts_at: pastConfirmed.toISOString(),
            ends_at: endsPastConfirmed.toISOString(),
            timezone: "America/Sao_Paulo",
            client_name: "Carlos Aguardando Ação",
            client_phone: "51955555555",
            client_email: "carlos@example.com",
            status: "confirmed",
            occupied_range: `[${pastConfirmed.toISOString()},${endsPastConfirmed.toISOString()})`,
          });
        if (appt5Error) throw appt5Error;

        // Criar contexto com o viewport específico
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: "pt-BR",
          timezoneId: "America/Sao_Paulo",
        });
        const page = await context.newPage();

        await login(page, email, password);
        await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });

        // Verificar que o dashboard carregou
        await expect(page.getByRole("heading", { name: businessName })).toBeVisible();

        // Verificar overflow horizontal da PÁGINA (não da tabela)
        await expectNoHorizontalOverflow(page);

        // Verificar tabela de agendamentos
        await expect(page.locator("table")).toBeVisible();

        // Verificar colunas específicas
        await expect(page.locator("th:has-text('Quando')")).toBeVisible();
        await expect(page.locator("th:has-text('Cliente')")).toBeVisible();
        await expect(page.locator("th:has-text('Serviço')")).toBeVisible();
        await expect(page.locator("th:has-text('Status')")).toBeVisible();
        await expect(page.locator("th:has-text('Ações')")).toBeVisible();

        // Verificar agendamentos específicos
        await expect(page.locator("text=João Confirmado")).toBeVisible();
        await expect(page.locator("text=Maria Cancelada")).toBeVisible();
        await expect(page.locator("text=Pedro Concluído")).toBeVisible();
        await expect(page.locator("text=Ana No-Show")).toBeVisible();
        await expect(page.locator("text=Carlos Aguardando Ação")).toBeVisible();

        // Verificar status
        await expect(page.locator("span.badge:has-text('confirmed')").first()).toBeVisible();
        await expect(page.locator("span.badge:has-text('cancelled')").first()).toBeVisible();
        await expect(page.locator("span.badge:has-text('completed')").first()).toBeVisible();
        await expect(page.locator("span.badge:has-text('no_show')").first()).toBeVisible();

        // Verificar botão Cancelar no agendamento futuro confirmado (João)
        const cancelButton = page.locator("button.danger:has-text('Cancelar')").first();
        await expect(cancelButton).toBeVisible();

        const cancelBox = await cancelButton.boundingBox();
        expect(cancelBox).not.toBeNull();
        expect(cancelBox!.width).toBeGreaterThanOrEqual(44);
        expect(cancelBox!.height).toBeGreaterThanOrEqual(44);

        // Verificar botões Concluir e Não compareceu no agendamento passado confirmado (Carlos)
        const concluirButton = page.locator("button.secondary:has-text('Concluir')").first();
        await expect(concluirButton).toBeVisible();

        const noShowButton = page.locator("button.secondary:has-text('Não compareceu')").first();
        await expect(noShowButton).toBeVisible();

        const concluirBox = await concluirButton.boundingBox();
        expect(concluirBox).not.toBeNull();
        expect(concluirBox!.width).toBeGreaterThanOrEqual(44);
        expect(concluirBox!.height).toBeGreaterThanOrEqual(44);

        const noShowBox = await noShowButton.boundingBox();
        expect(noShowBox).not.toBeNull();
        expect(noShowBox!.width).toBeGreaterThanOrEqual(44);
        expect(noShowBox!.height).toBeGreaterThanOrEqual(44);

        // Verificar se há scroll horizontal interno na tabela (permitido/intencional)
        const tableScrollInfo = await page.evaluate(() => {
          const tableContainer = document.querySelector("div[style*='overflowX: auto']");
          if (tableContainer) {
            return {
              scrollWidth: tableContainer.scrollWidth,
              clientWidth: tableContainer.clientWidth,
              hasHorizontalScroll: tableContainer.scrollWidth > tableContainer.clientWidth,
            };
          }
          return null;
        });

        // Scroll horizontal interno da tabela é comportamento intencional, não bug
        console.log(`Table scroll info for ${viewport.name}:`, tableScrollInfo);

        // Verificar legibilidade
        const joaoCell = page.locator("td:has-text('João Confirmado')").first();
        await expect(joaoCell).toBeVisible();

        const serviceCell = page.locator("td:has-text('Corte Audit')").first();
        await expect(serviceCell).toBeVisible();

        // Verificar navegação superior
        await expect(page.locator("nav")).toBeVisible();
        await expect(page.locator("text=AgendaFácil")).toBeVisible();

        // === ESTADO VAZIO ===
        // Deletar todos os appointments e recarregar
        await admin.from("appointments").delete().eq("user_id", userId);

        // Recarregar página
        await page.reload();
        await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });

        // Verificar estado vazio
        await expect(page.locator("text=Nenhum agendamento recente ou futuro.")).toBeVisible();

        // Verificar que a tabela não está mais presente
        await expect(page.locator("table")).not.toBeVisible();

        await context.close();
      } finally {
        if (userId) await admin.auth.admin.deleteUser(userId);
      }
    });
  }
});
