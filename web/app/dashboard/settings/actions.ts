"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BusinessSettingsState = {
  error: string | null;
  success: string | null;
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
  if (message.includes("slug_unavailable")) return "Esse endereço já está em uso. Escolha outro link.";
  if (message.includes("invalid_slug")) return "Use de 3 a 50 caracteres no link, apenas letras, números e hífens.";
  if (message.includes("invalid_phone")) return "Informe um telefone com DDD válido.";
  if (message.includes("invalid_name")) return "Informe seu nome profissional.";
  if (message.includes("invalid_business_name")) return "Informe um nome válido para o negócio.";
  if (message.includes("invalid_description")) return "A descrição deve ter no máximo 500 caracteres.";
  if (message.includes("invalid_city")) return "A cidade deve ter no máximo 120 caracteres.";
  if (message.includes("profile_not_configured")) return "Conclua a configuração inicial antes de editar o negócio.";
  return "Não foi possível salvar as configurações. Tente novamente.";
}

export async function saveBusinessSettings(
  _previousState: BusinessSettingsState,
  formData: FormData,
): Promise<BusinessSettingsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
  const businessName = String(formData.get("businessName") || "").trim();
  const slug = slugify(String(formData.get("slug") || ""));
  const description = String(formData.get("description") || "").trim();
  const city = String(formData.get("city") || "").trim();

  if (name.length < 2 || name.length > 120) return { error: "Informe seu nome profissional.", success: null };
  if (phone.length < 10 || phone.length > 15) return { error: "Informe um telefone com DDD válido.", success: null };
  if (businessName.length < 2 || businessName.length > 120) return { error: "Informe um nome válido para o negócio.", success: null };
  if (slug.length < 3) return { error: "O link precisa ter pelo menos 3 caracteres.", success: null };
  if (description.length > 500) return { error: "A descrição deve ter no máximo 500 caracteres.", success: null };
  if (city.length > 120) return { error: "A cidade deve ter no máximo 120 caracteres.", success: null };

  const { data: currentProfile } = await supabase
    .from("public_profiles")
    .select("slug")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.rpc("update_business_settings", {
    p_name: name,
    p_phone: phone,
    p_business_name: businessName,
    p_slug: slug,
    p_description: description,
    p_city: city,
  });

  if (error) return { error: mapRpcError(error.message), success: null };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  if (currentProfile?.slug) revalidatePath(`/${currentProfile.slug}`);
  revalidatePath(`/${slug}`);

  return { error: null, success: "Configurações salvas com sucesso." };
}
