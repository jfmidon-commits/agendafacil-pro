import Link from "next/link";

export default function PublicBookingNotFound() {
  return (
    <main>
      <div className="card" style={{ maxWidth: 560, margin: "40px auto" }}>
        <h1>Link de agendamento indisponível</h1>
        <p className="muted">
          Este endereço não existe, foi alterado ou o profissional desativou o agendamento online.
        </p>
        <Link className="button secondary" href="/">Voltar ao início</Link>
      </div>
    </main>
  );
}
