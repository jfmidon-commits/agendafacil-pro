"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("password") === "updated") {
      setMessage("Senha atualizada. Entre novamente com sua nova senha.");
    } else if (params.get("error") === "auth_link_expired") {
      setError("Esse link expirou ou já foi utilizado. Solicite um novo link.");
    } else if (params.get("error") === "invalid_auth_link") {
      setError("Link de autenticação inválido.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    });

    if (signInError) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    const requested = new URLSearchParams(window.location.search).get("next");
    router.push(safeInternalPath(requested, "/dashboard"));
    router.refresh();
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
        <h1>Entrar</h1>
        <form className="stack" onSubmit={submit}>
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Senha
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <div><Link href="/forgot-password">Esqueci minha senha</Link></div>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
        <p className="muted">Ainda não tem conta? <Link href="/signup">Cadastre-se</Link>.</p>
      </div>
    </main>
  );
}
