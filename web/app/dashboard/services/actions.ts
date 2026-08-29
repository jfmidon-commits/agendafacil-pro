"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(100),
  duration: z.coerce.number().int().min(5).max(720),
  bufferBefore: z.coerce.number().int().min(0).max(240),
  bufferAfter: z.coerce.number().int().min(0).max(240),
  price: z.coerce.number().min(0).max(1000000),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { supabase, user };
}

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    duration: formData.get("duration") || 30,
    bufferBefore: formData.get("bufferBefore") || 0,
    bufferAfter: formData.get("bufferAfter") || 0,
    price: formData.get("price") || 0,
  });
}

function payload(data: z.infer<typeof serviceSchema>) {
  return {
    name: data.name,
    duration_minutes: data.duration,
    buffer_before: data.bufferBefore,
    buffer_after: data.bufferAfter,
    price_cents: Math.round(data.price * 100),
  };
}

export async function createService(formData: FormData) {
  const parsed = parseService(formData);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Revise o serviço.");

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase.from("services").insert({
    user_id: user.id,
    ...payload(parsed.data),
    active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/services");
}

export async function updateService(id: string, formData: FormData) {
  const serviceId = uuidSchema.safeParse(id);
  const parsed = parseService(formData);
  if (!serviceId.success) throw new Error("Serviço inválido.");
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Revise o serviço.");

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("services")
    .update(payload(parsed.data))
    .eq("id", serviceId.data)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/services");
}

export async function toggleService(id: string, active: boolean) {
  const serviceId = uuidSchema.safeParse(id);
  if (!serviceId.success) throw new Error("Serviço inválido.");

  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId.data)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/services");
}
