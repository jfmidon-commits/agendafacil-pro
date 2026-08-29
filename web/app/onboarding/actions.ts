"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessName = String(formData.get("businessName") || "").trim();
  const requestedSlug = String(formData.get("slug") || businessName);
  const slug = slugify(requestedSlug);
  const serviceName = String(formData.get("serviceName") || "").trim();
  const duration = Number(formData.get("duration") || 30);
  const price = Math.round(Number(formData.get("price") || 0) * 100);
  const startTime = String(formData.get("startTime") || "09:00");
  const endTime = String(formData.get("endTime") || "18:00");
  const weekdays = formData.getAll("weekdays").map(Number).filter((v) => v >= 0 && v <= 6);

  if (businessName.length < 2 || slug.length < 3 || serviceName.length < 2 || weekdays.length === 0) {
    throw new Error("Preencha negócio, slug, serviço e pelo menos um dia de atendimento.");
  }

  const { error: publicError } = await supabase.from("public_profiles").upsert({
    user_id: user.id, business_name: businessName, slug, active: true,
  }, { onConflict: "user_id" });
  if (publicError) throw new Error(publicError.message);

  const { data: existingServices } = await supabase.from("services").select("id").eq("user_id", user.id).limit(1);
  if (!existingServices?.length) {
    const { error } = await supabase.from("services").insert({
      user_id: user.id, name: serviceName, duration_minutes: duration,
      price_cents: price, buffer_before: 0, buffer_after: 0, active: true,
    });
    if (error) throw new Error(error.message);
  }

  await supabase.from("availability_rules").delete().eq("user_id", user.id);
  const { error: rulesError } = await supabase.from("availability_rules").insert(
    weekdays.map((day) => ({
      user_id: user.id, day_of_week: day, start_time: startTime,
      end_time: endTime, slot_interval_minutes: 30, active: true,
    })),
  );
  if (rulesError) throw new Error(rulesError.message);

  redirect("/dashboard");
}
