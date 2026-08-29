import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeInternalPath("/onboarding")).toBe("/onboarding");
    expect(safeInternalPath("/reset-password?from=email#form")).toBe("/reset-password?from=email#form");
  });

  it("bloqueia URLs externas e protocol-relative", () => {
    expect(safeInternalPath("https://evil.example/phishing", "/login")).toBe("/login");
    expect(safeInternalPath("//evil.example/phishing", "/login")).toBe("/login");
  });

  it("usa fallback para valor vazio ou inválido", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
    expect(safeInternalPath("http://[", "/login")).toBe("/login");
  });
});
