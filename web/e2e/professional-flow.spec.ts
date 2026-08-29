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

function nextDateForWeekday(targetWeekday: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const base = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  let delta = (targetWeekday - base.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 2);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${STAGING_URL}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("Fluxo profissional completo — UI staging", () => {
  test.skip(!RUN_STAGING_E2E, "RUN_STAGING_E2E não está ativo.");

  test("login → onboarding → serviços → disponibilidade → booking → dashboard → logout/relogin", async ({ page, browser }) => {
    assertSafeTarget();

    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const id = crypto.randomUUID().slice(0, 8);
    const email = `pro-e2e-${id}@example.com`;
    const password = `E2E-${crypto.randomUUID()}-Aa1!`;
    const slug = `pro-e2e-${id}`;
    const businessName = `Barbearia E2E ${id}`;
    const clientName = `Cliente E2E ${id}`;
    let userId = "";
    let publicContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: "Barbeiro E2E", phone: "51988888888" },
      });
      if (createError || !created.user) throw createError || new Error("Failed to create staging E2E user.");
      userId = created.user.id;

      await login(page, email, password);
      await page.waitForURL(/\/onboarding$/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Seu link em poucos passos" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByLabel("Nome do negócio").fill(businessName);
      await page.getByLabel("Slug do link").fill(slug);
      await page.getByLabel("Primeiro serviço").fill("Corte E2E");
      await page.getByLabel("Duração (min)").fill("30");
      await page.getByLabel("Preço (R$)").fill("35.00");
      await page.getByLabel("Intervalo dos horários").selectOption("30");

      const removeScheduleButtons = page.getByRole("button", { name: "Remover" });
      await expect(removeScheduleButtons).toHaveCount(2);
      await removeScheduleButtons.last().click();

      await page.getByRole("button", { name: "Salvar e abrir meu painel" }).click();
      await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
      await expect(page.getByText(`/${slug}`, { exact: true })).toBeVisible();
      await expect(page.getByText(/Plano pro \(trial\)/i)).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto(`${STAGING_URL}/dashboard/settings`);
      await page.getByLabel("Descrição pública").fill("Barbearia de teste do fluxo profissional.");
      await page.getByLabel("Cidade").fill("Viamão - RS");
      await page.getByRole("button", { name: "Salvar configurações" }).click();
      await expect(page.getByText("Configurações salvas com sucesso.")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto(`${STAGING_URL}/dashboard/services`);
      const newServiceForm = page.locator("form").filter({
        has: page.getByRole("button", { name: "Adicionar serviço" }),
      });
      await newServiceForm.getByLabel("Nome").fill("Barba E2E");
      await newServiceForm.getByLabel("Duração").fill("20");
      await newServiceForm.getByLabel("Preço R$").fill("25.00");
      await newServiceForm.getByRole("button", { name: "Adicionar serviço" }).click();
      await expect(page.getByText("Barba E2E", { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.goto(`${STAGING_URL}/dashboard/availability`);
      const availabilityForm = page.locator("form").filter({
        has: page.getByRole("button", { name: "Adicionar regra" }),
      });
      await availabilityForm.getByLabel("Dia").selectOption("6");
      await availabilityForm.getByLabel("Início").fill("09:00");
      await availabilityForm.getByLabel("Fim").fill("14:00");
      await availabilityForm.getByLabel("Intervalo de slots").selectOption("30");
      await availabilityForm.getByRole("button", { name: "Adicionar regra" }).click();
      await expect(page.getByText(/Sáb\s+09:00–14:00/)).toBeVisible();
      await expectNoHorizontalOverflow(page);

      publicContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const publicPage = await publicContext.newPage();
      await publicPage.goto(`${STAGING_URL}/${slug}`);
      await expect(publicPage.getByRole("heading", { name: businessName })).toBeVisible();
      await expectNoHorizontalOverflow(publicPage);

      const serviceSelect = publicPage.getByLabel("Serviço");
      const barbaOption = serviceSelect.locator("option").filter({ hasText: "Barba E2E" });
      const barbaValue = await barbaOption.getAttribute("value");
      expect(barbaValue).toBeTruthy();
      await serviceSelect.selectOption(barbaValue!);

      await publicPage.getByLabel("Data").fill(nextDateForWeekday(6));
      const firstSlot = publicPage.locator(".slot-grid button").first();
      await expect(firstSlot).toBeVisible({ timeout: 20_000 });
      await firstSlot.click();
      await publicPage.getByLabel("Nome").fill(clientName);
      await publicPage.getByLabel("WhatsApp").fill("51999999999");
      await publicPage.getByLabel("E-mail (opcional)").fill(`cliente-${id}@example.com`);
      await publicPage.getByRole("button", { name: "Confirmar agendamento" }).click();
      await expect(publicPage.getByRole("heading", { name: /Agendamento confirmado/ })).toBeVisible({ timeout: 20_000 });
      await expect(publicPage.getByRole("link", { name: "Abrir link de cancelamento" })).toBeVisible();

      await page.goto(`${STAGING_URL}/dashboard`);
      const appointmentRow = page.locator("tbody tr").filter({ hasText: clientName });
      await expect(appointmentRow).toBeVisible({ timeout: 20_000 });
      await expect(appointmentRow).toContainText("confirmed");
      await appointmentRow.getByRole("button", { name: "Cancelar" }).click();
      await expect(appointmentRow).toContainText("cancelled", { timeout: 20_000 });

      await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
      await page.getByRole("button", { name: "Sair" }).click();
      await page.waitForURL(/\/login$/, { timeout: 20_000 });
      await page.goto(`${STAGING_URL}/dashboard`);
      await page.waitForURL(/\/login/, { timeout: 20_000 });

      await login(page, email, password);
      await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    } finally {
      if (publicContext) await publicContext.close();
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
