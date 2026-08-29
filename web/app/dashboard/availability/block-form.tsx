"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { addScheduleBlock } from "./actions";

export default function BlockForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    const form = event.currentTarget;
    const source = new FormData(form);
    const starts = new Date(String(source.get("starts")));
    const ends = new Date(String(source.get("ends")));

    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      setMessage("Revise o início e o fim do bloqueio.");
      setSaving(false);
      return;
    }

    const payload = new FormData();
    payload.set("startsAt", starts.toISOString());
    payload.set("endsAt", ends.toISOString());
    payload.set("type", String(source.get("type") || "blocked"));
    payload.set("reason", String(source.get("reason") || ""));

    const result = await addScheduleBlock(payload);
    if (result?.error) {
      setMessage(result.error);
      setSaving(false);
      return;
    }

    form.reset();
    setMessage("Bloqueio criado.");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Início
        <input type="datetime-local" name="starts" required />
      </label>
      <label>
        Fim
        <input type="datetime-local" name="ends" required />
      </label>
      <label>
        Tipo
        <select name="type" defaultValue="blocked">
          <option value="break">Pausa</option>
          <option value="timeoff">Folga</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </label>
      <label>
        Motivo
        <input name="reason" maxLength={200} />
      </label>
      <button disabled={saving}>{saving ? "Salvando..." : "Bloquear horário"}</button>
      {message && <p className="muted">{message}</p>}
    </form>
  );
}
