import { describe, expect, it } from "vitest";
import { isNextLocalDay, localDateKey, nextLocalDateKey } from "@/lib/domain/reminders";

describe("next-day reminder window", () => {
  const zone = "America/Sao_Paulo";
  const now = new Date("2026-08-29T12:00:00.000Z"); // 09:00 local

  it("calcula corretamente a data local atual e seguinte", () => {
    expect(localDateKey(now, zone)).toBe("2026-08-29");
    expect(nextLocalDateKey(now, zone)).toBe("2026-08-30");
  });

  it("inclui todo o dia seguinte no fuso local", () => {
    expect(isNextLocalDay("2026-08-30T03:00:00.000Z", now, zone)).toBe(true); // 00:00
    expect(isNextLocalDay("2026-08-31T02:59:59.000Z", now, zone)).toBe(true); // 23:59:59
  });

  it("exclui horários fora do dia seguinte", () => {
    expect(isNextLocalDay("2026-08-30T02:59:59.000Z", now, zone)).toBe(false); // 23:59:59 do dia atual
    expect(isNextLocalDay("2026-08-31T03:00:00.000Z", now, zone)).toBe(false); // 00:00 de depois de amanhã
  });
});
