import { describe, expect, it } from "vitest";
import { mapPublicSchedulingError } from "./public-booking-errors";

describe("mapPublicSchedulingError", () => {
  it("mapeia recursos inexistentes para 404", () => {
    expect(mapPublicSchedulingError("profile_not_found")).toMatchObject({
      code: "profile_not_found",
      status: 404,
    });
    expect(mapPublicSchedulingError("service_not_found")).toMatchObject({
      code: "service_not_found",
      status: 404,
    });
  });

  it("mapeia conflitos de agenda para 409", () => {
    expect(mapPublicSchedulingError("slot_unavailable")).toMatchObject({ status: 409 });
    expect(mapPublicSchedulingError("slot_not_aligned")).toMatchObject({ status: 409 });
    expect(mapPublicSchedulingError("schedule_block_conflict")).toMatchObject({ status: 409 });
    expect(mapPublicSchedulingError("free_plan_limit_reached")).toMatchObject({ status: 409 });
  });

  it("não expõe mensagem interna desconhecida", () => {
    expect(mapPublicSchedulingError("database secret detail", "Falha pública")).toEqual({
      code: "unknown",
      message: "Falha pública",
      status: 500,
    });
  });
});
