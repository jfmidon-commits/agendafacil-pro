import { describe, expect, it } from "vitest";
import { billingPlanName } from "./billing";

describe("billingPlanName", () => {
  it("distingue Pro mensal e anual sem alterar o código do produto", () => {
    expect(billingPlanName("pro", "month")).toBe("Pro mensal");
    expect(billingPlanName("pro", "year")).toBe("Pro anual");
  });

  it("não inventa periodicidade para registros legados", () => {
    expect(billingPlanName("pro", null)).toBe("Pro");
  });

  it("mantém suporte ao plano Studio", () => {
    expect(billingPlanName("studio", "month")).toBe("Studio mensal");
  });
});
