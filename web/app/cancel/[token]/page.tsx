import { verifyCancelToken } from "@/lib/cancel-token";
import { createServiceClient } from "@/lib/supabase/service";
import CancelButton from "./cancel-button";

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyCancelToken(token);

  if (!verified) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 560, margin: "40px auto" }}>
          <h1>Link de cancelamento inválido</h1>
          <p className="muted">Este link é inválido ou já expirou.</p>
        </div>
      </main>
    );
  }

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("status,starts_at,service_name_snapshot,timezone")
    .eq("id", verified.appointmentId)
    .maybeSingle();

  if (!appointment) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 560, margin: "40px auto" }}>
          <h1>Agendamento não encontrado</h1>
          <p className="muted">Este agendamento não está mais disponível.</p>
        </div>
      </main>
    );
  }

  if (appointment.status !== "confirmed") {
    return (
      <main>
        <div className="card" style={{ maxWidth: 560, margin: "40px auto" }}>
          <h1>Agendamento não está mais ativo</h1>
          <p className="muted">Este horário já foi cancelado, concluído ou atualizado pelo profissional.</p>
        </div>
      </main>
    );
  }

  const when = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: appointment.timezone || "America/Sao_Paulo",
  }).format(new Date(appointment.starts_at));

  return (
    <main>
      <div className="card" style={{ maxWidth: 560, margin: "40px auto" }}>
        <h1>Cancelar agendamento</h1>
        <p><strong>{appointment.service_name_snapshot}</strong></p>
        <p className="muted">{when}</p>
        <p>Ao confirmar, o horário será liberado para outra pessoa.</p>
        <CancelButton token={token} />
      </div>
    </main>
  );
}
