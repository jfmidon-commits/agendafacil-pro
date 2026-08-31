import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const RUN_STAGING_E2E = process.env.RUN_STAGING_E2E === "1";
const STAGING_URL = process.env.NEXT_PUBLIC_APP_URL_STAGING || process.env.NEXT_PUBLIC_APP_URL || "";

type SubscriptionRow = {
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  plan: string;
  billing_interval: string | null;
  status: string;
  cancel_at_period_end: boolean;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the staging billing E2E.`);
  return value;
}

function assertSafeTarget() {
  const url = new URL(STAGING_URL);
  const host = url.hostname.toLowerCase();
  if (!host.includes("staging") && host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing billing E2E against non-staging host: ${host}`);
  }
}

function assertStripeTestKey(key: string) {
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("Refusing billing E2E with a Stripe key that is not explicitly TEST mode.");
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${STAGING_URL}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 });
}

async function waitForSubscription(
  admin: SupabaseClient,
  userId: string,
  predicate: (row: SubscriptionRow) => boolean,
  timeoutMs = 45_000,
) {
  const deadline = Date.now() + timeoutMs;
  let latest: SubscriptionRow | null = null;

  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id,stripe_subscription_id,stripe_price_id,plan,billing_interval,status,cancel_at_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    latest = data as SubscriptionRow | null;
    if (latest && predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for Stripe webhook synchronization. Latest row: ${JSON.stringify(latest)}`);
}

test.describe("Cobrança Stripe TEST — staging", () => {
  test.skip(!RUN_STAGING_E2E, "RUN_STAGING_E2E não está ativo.");

  test("checkout → webhook → mensal/anual → portal → cancelamento", async ({ page }) => {
    test.setTimeout(150_000);
    assertSafeTarget();

    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = requiredEnv("STRIPE_SECRET_KEY");
    assertStripeTestKey(stripeKey);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const stripe = new Stripe(stripeKey, { maxNetworkRetries: 2 });

    const id = crypto.randomUUID().slice(0, 8);
    const email = `billing-e2e-${id}@example.com`;
    const password = `E2E-${crypto.randomUUID()}-Aa1!`;
    let userId = "";
    let customerId = "";
    let subscriptionId = "";

    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: `Billing E2E ${id}`, phone: "51988888888" },
      });
      if (createError || !created.user) throw createError || new Error("Failed to create billing E2E user.");
      userId = created.user.id;

      await login(page, email, password);
      await page.goto(`${STAGING_URL}/dashboard/billing`);
      await expect(page.getByRole("heading", { name: "Plano e cobrança" })).toBeVisible();

      const checkoutResponse = await page.request.post(`${STAGING_URL}/api/stripe/checkout`, {
        data: { plan: "pro" },
      });
      expect(checkoutResponse.status()).toBe(200);
      const checkout = (await checkoutResponse.json()) as { url?: string };
      expect(checkout.url).toBeTruthy();
      expect(new URL(checkout.url!).hostname).toBe("checkout.stripe.com");

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();
      if (profileError || !profile?.stripe_customer_id) {
        throw profileError || new Error("Checkout did not persist the Stripe customer id.");
      }
      customerId = profile.stripe_customer_id;

      const monthlyPrices = await stripe.prices.list({
        active: true,
        lookup_keys: ["agendafacil_pro_monthly"],
        limit: 1,
      });
      const monthlyPrice = monthlyPrices.data[0];
      if (!monthlyPrice || monthlyPrice.livemode) {
        throw new Error("Stripe TEST monthly Pro price is unavailable.");
      }

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: monthlyPrice.id }],
        trial_period_days: 1,
        metadata: { user_id: userId, plan: "pro" },
      });
      subscriptionId = subscription.id;

      const monthlyRow = await waitForSubscription(
        admin,
        userId,
        (row) =>
          row.stripe_subscription_id === subscriptionId &&
          row.plan === "pro" &&
          row.billing_interval === "month" &&
          row.status === "trialing",
      );
      expect(monthlyRow.stripe_price_id).toBe(monthlyPrice.id);

      await page.goto(`${STAGING_URL}/dashboard/billing`);
      await expect(page.getByText(/Assinatura:\s*Pro mensal · em período de teste/i)).toBeVisible();

      const changeResponse = await page.request.post(`${STAGING_URL}/api/stripe/change-plan`, {
        data: { plan: "pro-annual" },
      });
      expect(changeResponse.status()).toBe(200);

      const annualRow = await waitForSubscription(
        admin,
        userId,
        (row) =>
          row.stripe_subscription_id === subscriptionId &&
          row.plan === "pro" &&
          row.billing_interval === "year",
      );
      expect(annualRow.stripe_price_id).not.toBe(monthlyPrice.id);

      await page.goto(`${STAGING_URL}/dashboard/billing`);
      await expect(page.getByText(/Assinatura:\s*Pro anual · em período de teste/i)).toBeVisible();

      const portalResponse = await page.request.post(`${STAGING_URL}/api/stripe/portal`);
      expect(portalResponse.status()).toBe(200);
      const portal = (await portalResponse.json()) as { url?: string };
      expect(portal.url).toBeTruthy();
      expect(new URL(portal.url!).hostname).toBe("billing.stripe.com");

      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      await waitForSubscription(
        admin,
        userId,
        (row) => row.stripe_subscription_id === subscriptionId && row.cancel_at_period_end === true,
      );

      await page.goto(`${STAGING_URL}/dashboard/billing`);
      await expect(page.getByText(/cancelamento agendado/i)).toBeVisible();
    } finally {
      if (subscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
          if (userId) {
            await waitForSubscription(
              admin,
              userId,
              (row) => row.stripe_subscription_id === subscriptionId && row.status === "canceled",
              20_000,
            ).catch(() => null);
          }
        } catch {}
      }
      if (customerId) {
        try {
          await stripe.customers.del(customerId);
        } catch {}
      }
      if (userId) await admin.auth.admin.deleteUser(userId);
    }
  });
});
