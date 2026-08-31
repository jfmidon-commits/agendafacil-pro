import Stripe from "stripe";

export type CheckoutPlan = "pro" | "pro-annual";
export type PaidPlan = "pro" | "studio";
export type BillingInterval = "month" | "year" | null;

const LOOKUP_KEYS: Record<CheckoutPlan, string> = {
  pro: "agendafacil_pro_monthly",
  "pro-annual": "agendafacil_pro_annual",
};

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { maxNetworkRetries: 2 });
}

export function lookupKeyForPlan(plan: CheckoutPlan) {
  return LOOKUP_KEYS[plan];
}

export function billingIntervalFromPrice(price: Pick<Stripe.Price, "recurring">): BillingInterval {
  const interval = price.recurring?.interval;
  return interval === "month" || interval === "year" ? interval : null;
}

export function billingPeriodFromSubscription(subscription: Pick<Stripe.Subscription, "items">) {
  const item = subscription.items.data[0];
  const legacy = subscription as unknown as {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };

  return {
    start: item?.current_period_start ?? legacy.current_period_start ?? null,
    end: item?.current_period_end ?? legacy.current_period_end ?? null,
  };
}

function envPriceForPlan(plan: CheckoutPlan) {
  return plan === "pro"
    ? process.env.STRIPE_PRICE_PRO_MONTHLY
    : process.env.STRIPE_PRICE_PRO_ANNUAL;
}

export async function getPriceId(plan: CheckoutPlan) {
  const override = envPriceForPlan(plan);
  if (override) return override;

  const lookupKey = lookupKeyForPlan(plan);
  const prices = await getStripe().prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) throw new Error(`Stripe price not found for lookup key ${lookupKey}`);
  return price.id;
}

export function planFromPrice(price: Pick<Stripe.Price, "id" | "lookup_key">): PaidPlan {
  if (
    price.lookup_key === LOOKUP_KEYS.pro ||
    price.lookup_key === LOOKUP_KEYS["pro-annual"] ||
    price.id === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    price.id === process.env.STRIPE_PRICE_PRO_ANNUAL
  ) {
    return "pro";
  }
  if (price.id === process.env.STRIPE_PRICE_STUDIO_MONTHLY) return "studio";
  throw new Error(`Unknown Stripe price: ${price.id}`);
}

export async function getStripeCatalogStatus() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { proMonthly: false, proAnnual: false, studioMonthly: false };
  }

  try {
    const prices = await getStripe().prices.list({
      active: true,
      lookup_keys: [LOOKUP_KEYS.pro, LOOKUP_KEYS["pro-annual"]],
      limit: 10,
    });
    const lookupKeys = new Set(prices.data.map((price) => price.lookup_key).filter(Boolean));
    return {
      proMonthly: Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY) || lookupKeys.has(LOOKUP_KEYS.pro),
      proAnnual: Boolean(process.env.STRIPE_PRICE_PRO_ANNUAL) || lookupKeys.has(LOOKUP_KEYS["pro-annual"]),
      studioMonthly: Boolean(process.env.STRIPE_PRICE_STUDIO_MONTHLY),
    };
  } catch {
    return {
      proMonthly: Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY),
      proAnnual: Boolean(process.env.STRIPE_PRICE_PRO_ANNUAL),
      studioMonthly: Boolean(process.env.STRIPE_PRICE_STUDIO_MONTHLY),
    };
  }
}
