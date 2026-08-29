import { NextResponse } from "next/server";
import { z } from "zod";
import { mapPublicSchedulingError } from "@/lib/domain/public-booking-errors";
import { createServiceClient } from "@/lib/supabase/service";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const querySchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,49}$/i),
  serviceId: z.string().uuid(),
  date: dateSchema,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_date: parsed.data.date,
  });

  if (error) {
    const mapped = mapPublicSchedulingError(
      error.message,
      "Não foi possível carregar os horários.",
    );
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  return NextResponse.json(
    { slots: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
