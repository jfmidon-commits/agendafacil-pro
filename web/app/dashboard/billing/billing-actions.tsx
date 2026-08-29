"use client";

import { useState } from "react";

type ProCheckoutPlan = "pro" | "pro-annual";

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({ error: "Falha inesperada" }));
  if (!response.ok) throw new Error(json.error || "Falha");
  return json;
}

export default function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkout(plan: ProCheckoutPlan) {
    try {
      setLoading(true);
      setError("");
      const result = await post("/api/stripe/checkout", { plan });
      window.location.href = result.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha");
      setLoading(false);
    }
  }

  async function portal() {
    try {
      setLoading(true);
      setError("");
      const result = await post("/api/stripe/portal");
      window.location.href = result.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha");
      setLoading(false);
    }
  }

  async function change(plan: ProCheckoutPlan) {
    try {
      setLoading(true);
      setError("");
      await post("/api/stripe/change-plan", { plan });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha");
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      {!hasSubscription ? (
        <div className="grid">
          <button disabled={loading} onClick={() => checkout("pro")}>
            Pro · R$39/mês
          </button>
          <button disabled={loading} onClick={() => checkout("pro-annual")}>
            Pro anual · R$348/ano
          </button>
        </div>
      ) : (
        <>
          <div className="row">
            <button disabled={loading} onClick={() => change("pro")}>
              Pro mensal
            </button>
            <button disabled={loading} onClick={() => change("pro-annual")}>
              Pro anual
            </button>
            <button className="secondary" disabled={loading} onClick={portal}>
              Gerenciar/cancelar no Stripe
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
