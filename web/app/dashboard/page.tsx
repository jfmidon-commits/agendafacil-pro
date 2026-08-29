import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateAppointmentStatus } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: publicProfile }, { data: subscription }, { data: appointments }] = await Promise.all([
    supabase.from("profiles").select("name,timezone,trial_status,trial_ends_at").eq("id", user.id).single(),
    supabase.from("public_profiles").select("business_name,slug").eq("user_id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("appointments").select("id,service_name_snapshot,starts_at,timezone,client_name,client_phone,status").gte("starts_at", new Date().toISOString()).order("starts_at").limit(30),
  ]);
  if (!publicProfile) redirect("/onboarding");

  const trialActive = profile?.trial_status === "active" && profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
  const paid = subscription && ["active","trialing"].includes(subscription.status);
  const plan = paid ? subscription.plan : trialActive ? "pro (trial)" : "free";
  const formatter = (tz: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:tz || "America/Sao_Paulo" });

  return <main>
    <div className="row"><div><span className="badge">Plano {plan}</span><h1>{publicProfile.business_name}</h1></div><div style={{marginLeft:"auto"}}><Link className="button secondary" href={`/${publicProfile.slug}`}>Abrir link público</Link></div></div>
    <div className="grid">
      <div className="card"><strong>Próximos agendamentos</strong><div style={{fontSize:36,fontWeight:800}}>{appointments?.length || 0}</div></div>
      <div className="card"><strong>Seu link</strong><p className="muted">/{publicProfile.slug}</p></div>
      <div className="card"><strong>Fuso horário</strong><p className="muted">{profile?.timezone}</p></div>
    </div>
    <div className="card"><h2>Agenda</h2>{!appointments?.length ? <p className="muted">Nenhum agendamento futuro.</p> : <div style={{overflowX:"auto"}}><table><thead><tr><th>Quando</th><th>Cliente</th><th>Serviço</th><th>Status</th><th>Ações</th></tr></thead><tbody>{appointments.map((a) => <tr key={a.id}><td>{formatter(a.timezone).format(new Date(a.starts_at))}</td><td>{a.client_name}<br/><span className="muted">{a.client_phone}</span></td><td>{a.service_name_snapshot}</td><td><span className="badge">{a.status}</span></td><td><div className="row">{a.status === "confirmed" && <><form action={updateAppointmentStatus.bind(null,a.id,"completed")}><button className="secondary">Concluir</button></form><form action={updateAppointmentStatus.bind(null,a.id,"cancelled")}><button className="danger">Cancelar</button></form></>}</div></td></tr>)}</tbody></table></div>}</div>
  </main>;
}
