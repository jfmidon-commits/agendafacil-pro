"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setValidSession(Boolean(data.user));
      setReady(true);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.assign("/login?password=updated");
  }

  if (!ready) {
    return <main><div className="card" style={{ maxWidth: 520, margin: "30px auto" }}><p className="muted">Validando link...</p></div></main>;
  }

  if (!validSession) {
    return (
      <main>
        <div className="card" style={{ maxWidth: 520, margin: "30px auto" }}>
          <h1>Link inválido ou expirado</h1>
          <p className="muted">Solicite um novo link para redefinir sua senha.</p>
          <Link className="button" href="/forgot-password">Solicitar novo link</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "30px auto" }}>
        <h1>Definir nova senha</h1>
        <form className="stack" onSubmit={submit}>
          <label>
            Nova senha
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            Confirmar nova senha
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={loading}>{loading ? "Atualizando..." : "Salvar nova senha"}</button>
        </form>
      </div>
    </main>
  );
}
