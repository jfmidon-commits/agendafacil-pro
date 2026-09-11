import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;

  // Supabase confirmation emails can land on the configured Site URL with
  // ?code=... instead of the explicit /auth/callback path. Forward the code
  // to the server callback so the PKCE session exchange still happens.
  if (params.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=/onboarding`);
  }

  return (
    <main>
      <section className="hero">
        <span className="badge">MVP seguro e versionado</span>
        <h1>Seus clientes marcam sozinhos. Você só atende.</h1>
        <p>Crie serviços, defina seus horários e compartilhe um link público de agendamento — sem conflito de agenda.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="button" href="/signup">Criar meu link grátis</Link>
          <Link className="button secondary" href="/login">Já tenho conta</Link>
        </div>
      </section>
      <section className="grid">
        <div className="card"><h3>Agenda protegida</h3><p className="muted">Reservas só são criadas pela API transacional. O banco impede horários sobrepostos.</p></div>
        <div className="card"><h3>Link público</h3><p className="muted">O cliente vê somente perfil, serviços e horários disponíveis — nunca seus dados privados.</p></div>
        <div className="card"><h3>Free para validar</h3><p className="muted">Até 10 agendamentos por mês no plano Free. Trial Pro de 14 dias para novos cadastros.</p></div>
      </section>
    </main>
  );
}
