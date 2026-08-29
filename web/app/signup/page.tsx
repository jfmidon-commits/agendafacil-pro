"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const email = String(form.get("email"));
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get("password")),
      options: {
        data: { name: String(form.get("name")), phone: String(form.get("phone")) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.session) window.location.href = "/onboarding";
    else setMessage(`Confira ${email} para confirmar o cadastro.`);
    setLoading(false);
  }

  return <main><div className="card" style={{maxWidth:520,margin:"30px auto"}}>
    <h1>Criar conta</h1><p className="muted">Você começa com 14 dias de recursos Pro.</p>
    <form className="stack" onSubmit={submit}>
      <label>Seu nome<input name="name" required maxLength={120}/></label>
      <label>WhatsApp<input name="phone" type="tel" required maxLength={30}/></label>
      <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>
      <label>Senha<input name="password" type="password" required minLength={8} autoComplete="new-password"/></label>
      {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}
      <button disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
    </form>
    <p className="muted">Já tem conta? <Link href="/login">Entrar</Link>.</p>
  </div></main>;
}
