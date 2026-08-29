"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const uuidSchema = z.string().uuid();
const blockTypeSchema = z.enum(["break", "timeoff", "blocked"]);

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { supabase, user };
}

export async function addAvailabilityRule(formData: FormData) {
  const parsed = z.object({
    day: z.coerce.number().int().min(0).max(6),
    start: timeSchema,
    end: timeSchema,
    interval: z.coerce.number().int().min(5).max(240),
  }).safeParse({
    day: formData.get("day"),
    start: formData.get("start"),
    end: formData.get("end"),
    interval: formData.get("interval") || 30,
  });

  if (!parsed.success || parsed.data.end <= parsed.data.start) {
    throw new Error("Revise dia, início, fim e intervalo da regra.");
  }

  const { supabase, user } = await authenticatedClient();
  const { data: duplicates, error: duplicateError } = await supabase
    .from("availability_rules")
    .select("id")
    .eq("user_id", user.id)
    .eq("day_of_week", parsed.data.day)
    .eq("start_time", parsed.data.start)
    .eq("end_time", parsed.data.end)
    .eq("slot_interval_minutes", parsed.data.interval)
    .eq("active", true)
    .limit(1);
  if (duplicateError) throw new Error(duplicateError.message);

  if (!duplicates?.length) {
    const { error } = await supabase.from("availability_rules").insert({
      user_id: user.id,
      day_of_week: parsed.data.day,
      start_time: parsed.data.start,
      end_time: parsed.data.end,
      slot_interval_minutes: parsed.data.interval,
      active: true,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/availability");
}

export async function deleteAvailabilityRule(formData: FormData) {
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) throw new Error("Regra inválida");
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}

export async function addScheduleBlock(formData: FormData) {
  const parsed = z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    type: blockTypeSchema,
    reason: z.string().max(200),
  }).safeParse({
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    type: formData.get("type"),
    reason: String(formData.get("reason") || "").trim(),
  });

  if (!parsed.success) return { error: "Revise os dados do bloqueio." };
  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
    return { error: "O fim do bloqueio precisa ser depois do início." };
  }

  try {
    const { supabase, user } = await authenticatedClient();
    const { error } = await supabase.from("schedule_blocks").insert({
      user_id: user.id,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      type: parsed.data.type,
      reason: parsed.data.reason || null,
    });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/availability");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao criar bloqueio." };
  }
}

export async function deleteScheduleBlock(formData: FormData) {
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) throw new Error("Bloqueio inválido");
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}
