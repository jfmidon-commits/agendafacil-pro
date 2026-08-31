import { createCancelToken } from "../cancel-token";
import { createServiceClient } from "../supabase/service";

function endpointFor(eventType: string) {
  if (eventType === "appointment.reminder_due") {
    return process.env.MAKE_REMINDER_WEBHOOK_URL || process.env.MAKE_APPOINTMENT_WEBHOOK_URL;
  }
  return process.env.MAKE_APPOINTMENT_WEBHOOK_URL;
}

async function buildAppointmentPayload(appointmentId: string, eventType: string) {
  const supabase = createServiceClient();
  const { data: appointment, error } = await supabase.from("appointments")
    .select("id,user_id,service_name_snapshot,starts_at,ends_at,timezone,client_name,client_phone,client_email,status")
    .eq("id", appointmentId).single();
  if (error || !appointment) throw new Error("appointment_not_found");

  const [{ data: professional }, { data: publicProfile }] = await Promise.all([
    supabase.from("profiles").select("name,phone").eq("id", appointment.user_id).single(),
    supabase.from("public_profiles").select("business_name,slug").eq("user_id", appointment.user_id).single(),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const exp = Math.floor(new Date(appointment.starts_at).getTime() / 1000);
  const cancelUrl = exp > Math.floor(Date.now()/1000)
    ? `${base}/cancel/${createCancelToken(appointment.id, exp)}` : null;

  return {
    event: eventType,
    occurredAt: new Date().toISOString(),
    appointment: {
      id: appointment.id,
      service: appointment.service_name_snapshot,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      timezone: appointment.timezone,
      status: appointment.status,
      client: { name: appointment.client_name, phone: appointment.client_phone, email: appointment.client_email },
      cancelUrl,
    },
    professional: {
      id: appointment.user_id,
      name: professional?.name || "",
      phone: professional?.phone || "",
      businessName: publicProfile?.business_name || "",
      slug: publicProfile?.slug || "",
    },
  };
}

export async function deliverIntegrationEvent(eventId: string) {
  const supabase = createServiceClient();
  const { data: event, error } = await supabase.from("integration_events")
    .select("id,appointment_id,event_type,attempts,delivered_at").eq("id", eventId).single();
  if (error || !event) throw new Error("integration_event_not_found");
  if (event.delivered_at) return true;

  const endpoint = endpointFor(event.event_type);
  if (!endpoint) {
    await supabase.from("integration_events").update({ attempts: event.attempts + 1, last_error: "make_webhook_not_configured" }).eq("id", event.id);
    return false;
  }

  try {
    const payload = await buildAppointmentPayload(event.appointment_id, event.event_type);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`make_http_${response.status}`);
    await supabase.from("integration_events").update({
      attempts: event.attempts + 1, delivered_at: new Date().toISOString(), last_error: null,
    }).eq("id", event.id);
    return true;
  } catch (error) {
    await supabase.from("integration_events").update({
      attempts: event.attempts + 1, last_error: error instanceof Error ? error.message : "make_delivery_failed",
    }).eq("id", event.id);
    return false;
  }
}

export async function postBillingEvent(payload: Record<string, unknown>) {
  const endpoint = process.env.MAKE_BILLING_WEBHOOK_URL;
  if (!endpoint) return false;
  const response = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload), signal:AbortSignal.timeout(8000) });
  return response.ok;
}
