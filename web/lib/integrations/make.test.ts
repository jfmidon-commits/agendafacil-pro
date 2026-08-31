import { describe, expect, it } from "vitest";
import { makeEventTypeFor } from "./make";

describe("makeEventTypeFor", () => {
  it("mantém compatibilidade com o roteador criado no Make", () => {
    expect(makeEventTypeFor("appointment.created")).toBe("appointment_created");
    expect(makeEventTypeFor("appointment.confirmed")).toBe("appointment_confirmed");
    expect(makeEventTypeFor("appointment.reminder_due")).toBe("appointment_reminder");
  });

  it("normaliza eventos futuros sem remover o campo canônico", () => {
    expect(makeEventTypeFor("appointment.cancelled")).toBe("appointment_cancelled");
  });
});
