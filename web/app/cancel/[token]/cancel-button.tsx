"use client";

import { useState } from "react";

type Message = { type: "success" | "error"; text: string } | null;

export default function CancelButton({ token }: { token: string }) {
  const [message, setMessage] = useState<Message>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function cancel() {
    if (loading || done) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          type: "error",
          text: body.error || "Não foi possível cancelar o agendamento.",
        });
        return;
      }

      setDone(true);
      setMessage({
        type: "success",
        text: "Agendamento cancelado com sucesso. O horário já foi liberado.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <button className="danger" onClick={cancel} disabled={loading || done}>
        {done ? "Agendamento cancelado" : loading ? "Cancelando..." : "Confirmar cancelamento"}
      </button>
      {message && (
        <p className={message.type === "success" ? "success" : "error"} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
