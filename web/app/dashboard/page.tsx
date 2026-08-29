import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateAppointmentStatus } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const recentWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: profile }, { data: publicProfile }, { data: subscription }, { data: appointments }] = await Promise.all([
    supabase.from("profiles").select("name,timezone,trial_status,trial_ends_at").eq("id", user.id).single(),
    supabase.from("public_profiles").select("business_name,slug").eq("user_id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("appointments")
      .select("id,service_name_snapshot,starts_at,timezone,client_name,client_phone,status")
      .gte("starts_at", recentWindow)
      .order("starts_at")
      .limit(50),
  ]);
  if (!publicProfile) redirect("/onboarding");

  const trialActive = profile?.trial_status === "active" && profile?.trial_ends_at && new Date(profile.trial_ends_at) > now;
  const paid = subscription && ["active", "trialing"].includes(subscription.status);
  const plan = paid ? subscription.plan : trialActive ? "pro (trial)" : "free";
  const formatter = (tz: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: tz || "America/Sao_Paulo",
  });
  const upcomingCount = appointments?.filter(
    (appointment) => appointment.status === "confirmed" && new Date(appointment.starts_at) >= now,
  ).length || 0;

  return (
    <main>
      <div className="row">
        <div>
          <span className="badge">Plano {plan}</span>
          <h1>{publicProfile.business_name}</h1>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Link className="button secondary" href={`/${publicProfile.slug}`}>Abrir link público</Link>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <strong>Próximos agendamentos</strong>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{upcomingCount}</div>
        </div>
        <div className="card">
          <strong>Seu link</strong>
          <p className="muted">/{publicProfile.slug}</p>
        </div>
        <div className="card">
          <strong>Fuso horário</strong>
          <p className="muted">{profile?.timezone}</p>
        </div>
      </div>

      <div className="card">
        <h2>Agenda recente e próxima</h2>
        <p className="muted">Os últimos horários continuam visíveis para você concluir ou marcar ausência.</p>
        {!appointments?.length ? (
          <p className="muted">Nenhum agendamento recente ou futuro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => {
                  const started = new Date(appointment.starts_at) <= now;
                  return (
                    <tr key={appointment.id}>
                      <td>{formatter(appointment.timezone).format(new Date(appointment.starts_at))}</td>
                      <td>
                        {appointment.client_name}<br />
                        <span className="muted">{appointment.client_phone}</span>
                      </td>
                      <td>{appointment.service_name_snapshot}</td>
                      <td><span className="badge">{appointment.status}</span></td>
                      <td>
                        <div className="row">
                          {appointment.status === "confirmed" && !started && (
                            <form action={updateAppointmentStatus.bind(null, appointment.id, "cancelled")}>
                              <button className="danger">Cancelar</button>
                            </form>
                          )}
                          {appointment.status === "confirmed" && started && (
                            <>
                              <form action={updateAppointmentStatus.bind(null, appointment.id, "completed")}>
                                <button className="secondary">Concluir</button>
                              </form>
                              <form action={updateAppointmentStatus.bind(null, appointment.id, "no_show")}>
                                <button className="secondary">Não compareceu</button>
                              </form>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
