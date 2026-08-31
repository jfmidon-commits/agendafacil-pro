import { afterEach, describe, expect, it } from "vitest";
import {
  billingIntervalFromPrice,
  billingPeriodFromSubscription,
  lookupKeyForPlan,
  planFromPrice,
} from "./stripe";

const originalMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
const originalAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL;
const originalStudio = process.env.STRIPE_PRICE_STUDIO_MONTHLY;

afterEach(() => {
  process.env.STRIPE_PRICE_PRO_MONTHLY = originalMonthly;
  process.env.STRIPE_PRICE_PRO_ANNUAL = originalAnnual;
  process.env.STRIPE_PRICE_STUDIO_MONTHLY = originalStudio;
});

describe("Stripe catalog mapping", () => {
  it("uses stable lookup keys for the beta Pro plans", () => {
    expect(lookupKeyForPlan("pro")).toBe("agendafacil_pro_monthly");
    expect(lookupKeyForPlan("pro-annual")).toBe("agendafacil_pro_annual");
  });

  it("maps monthly and annual lookup keys to the Pro entitlement", () => {
    expect(planFromPrice({ id: "price_monthly", lookup_key: "agendafacil_pro_monthly" })).toBe("pro");
    expect(planFromPrice({ id: "price_annual", lookup_key: "agendafacil_pro_annual" })).toBe("pro");
  });

  it("keeps legacy price-id overrides compatible", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_legacy_monthly";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_legacy_annual";
    expect(planFromPrice({ id: "price_legacy_monthly", lookup_key: null })).toBe("pro");
    expect(planFromPrice({ id: "price_legacy_annual", lookup_key: null })).toBe("pro");
  });

  it("extracts monthly and annual billing intervals", () => {
    expect(billingIntervalFromPrice({ recurring: { interval: "month" } } as never)).toBe("month");
    expect(billingIntervalFromPrice({ recurring: { interval: "year" } } as never)).toBe("year");
  });

  it("treats unsupported or non-recurring prices as unknown cadence", () => {
    expect(billingIntervalFromPrice({ recurring: null } as never)).toBeNull();
    expect(billingIntervalFromPrice({ recurring: { interval: "week" } } as never)).toBeNull();
  });

  it("reads billing periods from subscription items on current Stripe APIs", () => {
    expect(
      billingPeriodFromSubscription({
        items: {
          data: [{ current_period_start: 100, current_period_end: 200 }],
        },
      } as never),
    ).toEqual({ start: 100, end: 200 });
  });

  it("keeps compatibility with legacy subscription-level billing periods", () => {
    expect(
      billingPeriodFromSubscription({
        items: { data: [] },
        current_period_start: 300,
        current_period_end: 400,
      } as never),
    ).toEqual({ start: 300, end: 400 });
  });

  it("rejects an unknown price", () => {
    expect(() => planFromPrice({ id: "price_unknown", lookup_key: null })).toThrow("Unknown Stripe price");
  });
});
