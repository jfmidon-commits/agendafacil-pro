import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BusinessSettingsForm from "./form";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: publicProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name,phone")
      .eq("id", user.id)
      .single(),
    supabase
      .from("public_profiles")
      .select("business_name,slug,description,city")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!publicProfile) redirect("/onboarding");

  return (
    <main>
      <div className="card" style={{ maxWidth: 760, margin: "20px auto" }}>
        <span className="badge">Seu negócio</span>
        <h1>Configurações</h1>
        <p className="muted">
          Atualize os dados usados no seu painel, link público e integrações de atendimento.
        </p>
        <BusinessSettingsForm
          initialName={profile?.name || ""}
          initialPhone={profile?.phone || ""}
          initialBusinessName={publicProfile.business_name || ""}
          initialSlug={publicProfile.slug || ""}
          initialDescription={publicProfile.description || ""}
          initialCity={publicProfile.city || ""}
          appUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
        />
      </div>
    </main>
  );
}
