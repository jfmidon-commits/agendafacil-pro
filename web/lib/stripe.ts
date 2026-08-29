import Stripe from "stripe";

export type CheckoutPlan = "pro" | "pro-annual" | "studio";
export type PaidPlan = "pro" | "studio";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { maxNetworkRetries: 2 });
}

export function getPriceId(plan: CheckoutPlan) {
  const value = plan === "pro" ? process.env.STRIPE_PRICE_PRO_MONTHLY
    : plan === "pro-annual" ? process.env.STRIPE_PRICE_PRO_ANNUAL
    : process.env.STRIPE_PRICE_STUDIO_MONTHLY;
  if (!value) throw new Error(`Stripe price not configured for ${plan}`);
  return value;
}

export function planFromPriceId(priceId: string): PaidPlan {
  if (priceId === process.env.STRIPE_PRICE_STUDIO_MONTHLY) return "studio";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return "pro";
  throw new Error(`Unknown Stripe price: ${priceId}`);
}
