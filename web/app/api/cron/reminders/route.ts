import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { isNextLocalDay } from "@/lib/domain/reminders";
import { deliverIntegrationEvent } from "@/lib/integrations/make";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const from = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id,starts_at,timezone")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .limit(1000);

  const candidates = (appointments || []).filter((appointment) =>
    isNextLocalDay(appointment.starts_at, now, appointment.timezone),
  );

  let sent = 0;
  for (const appointment of candidates) {
    const { data: event } = await supabase
      .from("integration_events")
      .upsert(
        { appointment_id: appointment.id, event_type: "appointment.reminder_due" },
        { onConflict: "appointment_id,event_type" },
      )
      .select("id")
      .single();

    if (event?.id && await deliverIntegrationEvent(event.id)) {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appointment.id)
        .is("reminder_sent_at", null);
      sent += 1;
    }
  }

  return NextResponse.json({
    checked: appointments?.length || 0,
    eligible: candidates.length,
    sent,
    strategy: "next_local_day",
    broadWindow: { from, to },
  });
}
