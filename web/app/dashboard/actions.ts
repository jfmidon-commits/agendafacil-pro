"use server";

import { revalidatePath } from "next/cache";
import { deliverIntegrationEvent } from "@/lib/integrations/make";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type OwnerStatus = "cancelled" | "completed" | "no_show";

export async function updateAppointmentStatus(id: string, status: OwnerStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  if (status === "cancelled") {
    const service = createServiceClient();
    const { data, error } = await service.rpc("cancel_appointment_by_owner", {
      p_appointment_id: id,
      p_user_id: user.id,
    });
    if (error) {
      if (error.message.includes("appointment_not_found")) throw new Error("Agendamento não encontrado.");
      if (error.message.includes("appointment_not_active")) throw new Error("O agendamento não está mais ativo.");
      throw new Error("Não foi possível cancelar o agendamento.");
    }

    const eventId = data?.[0]?.integration_event_id;
    if (eventId) await deliverIntegrationEvent(eventId).catch(() => false);
  } else {
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("O agendamento não está mais ativo.");
  }

  revalidatePath("/dashboard");
}
