"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

type ScheduleGroup = {
  days: number[];
  startTime: string;
  endTime: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function mapRpcError(message: string) {
  if (message.includes("slug_unavailable")) return "Esse endereço já está em uso. Escolha outro slug.";
  if (message.includes("invalid_slug")) return "Use um slug com 3 a 50 caracteres, apenas letras, números e hífens.";
  if (message.includes("invalid_schedule_window")) return "O horário de fechamento deve ser depois do horário de abertura.";
  if (message.includes("duplicate_schedule_rule")) return "Há um horário duplicado na agenda.";
  if (message.includes("invalid_schedule")) return "Configure pelo menos um horário de atendimento.";
  return "Não foi possível salvar sua configuração. Revise os dados e tente novamente.";
}

function parseSchedule(raw: string): ScheduleGroup[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const groups: ScheduleGroup[] = [];
    const seen = new Set<string>();
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      if (!Array.isArray(candidate.days)) return null;

      const days = [...new Set(candidate.days.map(Number))]
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((a, b) => a - b);
      const startTime = String(candidate.startTime || "");
      const endTime = String(candidate.endTime || "");

      if (days.length === 0) continue;
      if (!timePattern.test(startTime) || !timePattern.test(endTime) || endTime <= startTime) return null;

      for (const day of days) {
        const key = `${day}|${startTime}|${endTime}`;
        if (seen.has(key)) return null;
        seen.add(key);
      }

      groups.push({ days, startTime, endTime });
    }

    return groups.length ? groups : null;
  } catch {
    return null;
  }
}

export async function saveOnboarding(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessName = String(formData.get("businessName") || "").trim();
  const requestedSlug = String(formData.get("slug") || businessName);
  const slug = slugify(requestedSlug);
  const serviceName = String(formData.get("serviceName") || "").trim();
  const duration = Number(formData.get("duration") || 30);
  const priceNumber = Number(formData.get("price") || 0);
  const priceCents = Math.round(priceNumber * 100);
  const slotInterval = Number(formData.get("slotInterval") || 30);
  const schedule = parseSchedule(String(formData.get("scheduleJson") || "[]"));

  if (businessName.length < 2 || businessName.length > 120) return { error: "Informe um nome de negócio válido." };
  if (slug.length < 3) return { error: "O slug precisa ter pelo menos 3 caracteres." };
  if (serviceName.length < 2 || serviceName.length > 120) return { error: "Informe um nome de serviço válido." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) return { error: "A duração do serviço deve ficar entre 5 e 720 minutos." };
  if (!Number.isFinite(priceNumber) || priceNumber < 0 || priceCents < 0) return { error: "Informe um preço válido." };
  if (![15, 30, 60].includes(slotInterval)) return { error: "Escolha um intervalo de agenda válido." };
  if (!schedule) return { error: "Configure pelo menos um grupo de dias com horário válido e sem duplicatas." };

  const { error } = await supabase.rpc("save_onboarding_config", {
    p_business_name: businessName,
    p_slug: slug,
    p_service_name: serviceName,
    p_duration_minutes: duration,
    p_price_cents: priceCents,
    p_slot_interval_minutes: slotInterval,
    p_schedule: schedule,
  });

  if (error) return { error: mapRpcError(error.message) };

  redirect("/dashboard");
}
