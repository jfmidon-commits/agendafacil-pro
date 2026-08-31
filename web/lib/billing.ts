export type BillingPlan = "pro" | "studio";
export type BillingInterval = "month" | "year" | null | undefined;

export function billingPlanName(plan: BillingPlan, interval: BillingInterval) {
  const product = plan === "studio" ? "Studio" : "Pro";
  if (interval === "year") return `${product} anual`;
  if (interval === "month") return `${product} mensal`;
  return product;
}
