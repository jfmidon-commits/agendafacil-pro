import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const RUN_SIGNUP_UI_E2E = process.env.RUN_SIGNUP_UI_E2E === "1";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the signup staging smoke test.`);
  return value;
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < 100) return null;
  }
  return null;
}

test.describe("Signup real — smoke manual de staging", () => {
  test.skip(!RUN_STAGING_E2E || !RUN_SIGNUP_UI_E2E, "Ative RUN_STAGING_E2E=1 e RUN_SIGNUP_UI_E2E=1 para enviar um signup real.");

  test("cria usuário pela tela de cadastro sem depender da entrega do e-mail", async ({ page }) => {
    const target = new URL(STAGING_URL);
    if (!target.hostname.includes("staging") && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") {
      throw new Error(`Refusing signup smoke against non-staging host: ${target.hostname}`);
    }

    const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const id = crypto.randomUUID().slice(0, 8);
    const email = `signup-e2e-${id}@example.com`;
    const password = `E2E-${crypto.randomUUID()}-Aa1!`;
    let userId: string | null = null;

    try {
      await page.goto(`${STAGING_URL}/signup`);
      await page.getByLabel("Seu nome").fill("Signup E2E");
      await page.getByLabel("WhatsApp").fill("51977777777");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Criar conta" }).click();

      await expect
        .poll(async () => {
          userId = await findUserIdByEmail(admin, email);
          return Boolean(userId);
        }, { timeout: 15_000 })
        .toBe(true);

      const directSession = page.url().endsWith("/onboarding");
      if (!directSession) {
        await expect(page.getByText(new RegExp(`Confira ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} para confirmar o cadastro\\.`))).toBeVisible();
      }
    } finally {
      if (!userId) userId = await findUserIdByEmail(admin, email).catch(() => null);
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
