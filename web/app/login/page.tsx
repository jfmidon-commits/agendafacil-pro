"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter(); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {event.preventDefault(); setLoading(true); setError("");const form = new FormData(event.currentTarget);const supabase = createClient();const { error } = await supabase.auth.signInWithPassword({email: String(form.get("email")), password: String(form.get("password"))});if (error) { setError(error.message); setLoading(false); return; }const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";router.push(next); router.refresh();}
  return <main><div className="card" style={{maxWidth:480,margin:"40px auto"}}><h1>Entrar</h1><form className="stack" onSubmit={submit}><label>E-mail<input name="email" type="email" required autoComplete="email" /></label><label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button></form><p className="muted">Ainda não tem conta? <Link href="/signup">Cadastre-se</Link>.</p></div></main>;
}
