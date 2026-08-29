"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SessionNav() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthenticated(Boolean(session?.user));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (authenticated === null) {
    return <span className="muted">Carregando...</span>;
  }

  if (!authenticated) {
    return <Link href="/login">Entrar</Link>;
  }

  return (
    <>
      <Link href="/dashboard">Painel</Link>
      <Link href="/dashboard/services">Serviços</Link>
      <Link href="/dashboard/availability">Horários</Link>
      <Link href="/dashboard/settings">Configurações</Link>
      <Link href="/dashboard/billing">Plano</Link>
      <button type="button" className="secondary" onClick={signOut}>Sair</button>
    </>
  );
}
