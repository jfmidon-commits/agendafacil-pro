import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protected-path";

describe("isProtectedPath", () => {
  it("protege dashboard e onboarding reais", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/settings")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/onboarding/step-2")).toBe(true);
  });

  it("não confunde slugs públicos com prefixos privados", () => {
    expect(isProtectedPath("/dashboard-barbearia")).toBe(false);
    expect(isProtectedPath("/dashboard123")).toBe(false);
    expect(isProtectedPath("/onboarding-e2e-1234")).toBe(false);
    expect(isProtectedPath("/onboardingbarber")).toBe(false);
  });

  it("mantém demais rotas públicas livres", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/barbearia-do-juliano")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });
});
