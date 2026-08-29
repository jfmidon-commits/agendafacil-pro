import { createClient } from "@/lib/supabase/server";
import { saveOnboarding } from "./actions";

const days = [[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[0,"Dom"]] as const;

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("public_profiles").select("business_name,slug").eq("user_id", user!.id).maybeSingle();

  return <main><div className="card" style={{maxWidth:720,margin:"20px auto"}}>
    <span className="badge">Configuração inicial</span><h1>Seu link em poucos passos</h1>
    <form action={saveOnboarding} className="stack">
      <label>Nome do negócio<input name="businessName" defaultValue={profile?.business_name || ""} required /></label>
      <label>Slug do link<input name="slug" defaultValue={profile?.slug || ""} placeholder="barbearia-do-joao" required /></label>
      <div className="grid">
        <label>Primeiro serviço<input name="serviceName" placeholder="Corte de cabelo" required /></label>
        <label>Duração (min)<input name="duration" type="number" min="5" max="720" defaultValue="30" required /></label>
        <label>Preço (R$)<input name="price" type="number" min="0" step="0.01" defaultValue="0" /></label>
      </div>
      <div><strong>Dias de atendimento</strong><div className="row" style={{marginTop:8}}>{days.map(([value,label]) => <label key={value} style={{display:"flex",gap:4,fontWeight:500}}><input style={{width:"auto"}} type="checkbox" name="weekdays" value={value} defaultChecked={value>=1&&value<=5}/>{label}</label>)}</div></div>
      <div className="grid"><label>Abre às<input name="startTime" type="time" defaultValue="09:00" required /></label><label>Fecha às<input name="endTime" type="time" defaultValue="18:00" required /></label></div>
      <button>Salvar e abrir meu painel</button>
    </form>
  </div></main>;
}
