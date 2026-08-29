import { NextResponse } from "next/server";
import { z } from "zod";
import { createCancelToken } from "@/lib/cancel-token";
import { mapPublicSchedulingError } from "@/lib/domain/public-booking-errors";
import { deliverIntegrationEvent } from "@/lib/integrations/make";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,49}$/i),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(8).max(30),
  clientEmail: z.string().email().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido.", code: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de agendamento inválidos.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase.rpc("book_appointment", {
    p_slug: data.slug,
    p_service_id: data.serviceId,
    p_starts_at: data.startsAt,
    p_client_name: data.clientName,
    p_client_phone: data.clientPhone,
    p_client_email: data.clientEmail || null,
    p_notes: data.notes || null,
  });

  if (error) {
    const mapped = mapPublicSchedulingError(
      error.message,
      "Não foi possível concluir a reserva.",
    );
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  const row = rows?.[0];
  if (!row) {
    return NextResponse.json(
      { error: "Reserva não criada.", code: "booking_not_created" },
      { status: 500 },
    );
  }

  const expiresAt = Math.floor(new Date(row.starts_at).getTime() / 1000);
  const token = createCancelToken(row.appointment_id, expiresAt);
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  await deliverIntegrationEvent(row.integration_event_id).catch(() => false);

  return NextResponse.json(
    {
      appointmentId: row.appointment_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      cancelUrl: `${base}/cancel/${token}`,
    },
    { status: 201 },
  );
}
