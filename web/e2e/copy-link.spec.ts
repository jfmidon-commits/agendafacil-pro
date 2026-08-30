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

test.describe("Botão Copiar Link — responsividade e funcionalidade", () => {
  test.skip(!RUN_STAGING_E2E, "RUN_STAGING_E2E não está ativo.");

  const viewports = [
    { name: "360x800", width: 360, height: 800 },
    { name: "390x844", width: 390, height: 844 },
    { name: "412x915", width: 412, height: 915 },
  ];

  for (const viewport of viewports) {
    test(`dashboard com botão copiar link em ${viewport.name}`, async ({ browser }) => {
      assertSafeTarget();

      const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
      const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const id = crypto.randomUUID().slice(0, 8);
      const email = `copylink-${id}@example.com`;
      const password = `E2E-${crypto.randomUUID()}-Aa1!`;
      const slug = `copylink-${id}`;
      const businessName = `CopyLink E2E ${id}`;
      let userId = "";

      try {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: "Barbeiro CopyLink", phone: "51988888888" },
        });
        if (createError || !created.user) throw createError || new Error("Failed to create user.");
        userId = created.user.id;

        // Criar perfil público diretamente
        const { error: profileError } = await admin
          .from("public_profiles")
          .insert({
            user_id: userId,
            business_name: businessName,
            slug,
            description: "Teste do botão copiar link",
            active: true,
          });
        if (profileError) throw profileError;

        // Criar contexto com o viewport específico
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: "pt-BR",
          timezoneId: "America/Sao_Paulo",
          permissions: ["clipboard-write", "clipboard-read"],
        });
        const page = await context.newPage();

        await login(page, email, password);
        await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });

        // Verificar que o dashboard carregou
        await expect(page.getByRole("heading", { name: businessName })).toBeVisible();

        // Verificar overflow horizontal
        await expectNoHorizontalOverflow(page);

        // Verificar que o botão "Copiar link" está visível
        const copyButton = page.getByRole("button", { name: "Copiar link" });
        await expect(copyButton).toBeVisible();

        // Verificar touch target razoável (mínimo 44x44)
        const box = await copyButton.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);

        // Clicar no botão
        await copyButton.click();

        // Verificar feedback "Link copiado!"
        await expect(page.getByRole("button", { name: "Link copiado!" })).toBeVisible();

        // Verificar que a URL copiada corresponde ao link público completo
        const expectedUrl = `${STAGING_URL}/${slug}`;
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toBe(expectedUrl);

        // Verificar que o feedback desaparece (aguardar 2.5s para garantir)
        await page.waitForTimeout(2500);
        await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

        // Verificar overflow novamente após interação
        await expectNoHorizontalOverflow(page);

        await context.close();
      } finally {
        if (userId) await admin.auth.admin.deleteUser(userId);
      }
    });
  }
});
