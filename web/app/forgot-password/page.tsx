"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (resetError) {
      setError("Não foi possível enviar o link agora. Aguarde um pouco e tente novamente.");
    } else {
      setMessage("Se existir uma conta com esse e-mail, enviaremos um link para redefinir a senha.");
    }
    setLoading(false);
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "30px auto" }}>
        <h1>Recuperar senha</h1>
        <p className="muted">Informe o e-mail usado no AgendaFácil Pro.</p>
        <form className="stack" onSubmit={submit}>
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button disabled={loading}>{loading ? "Enviando..." : "Enviar link de recuperação"}</button>
        </form>
        <p className="muted"><Link href="/login">Voltar para entrar</Link>.</p>
      </div>
    </main>
  );
}
