"use client";

import { FormEvent, useCallback, useMemo, useState, useEffect } from "react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};

type Slot = {
  starts_at: string;
  ends_at: string;
  label: string;
  timezone: string;
};

type ApiError = { error?: string; code?: string };

const refreshableConflicts = new Set([
  "slot_unavailable",
  "slot_not_aligned",
  "schedule_block_conflict",
  "outside_availability",
  "start_must_be_in_future",
]);

function todayForDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BookingForm({ slug, services }: { slug: string; services: Service[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; cancelUrl: string } | null>(null);
  const minDate = useMemo(todayForDateInput, []);

  const loadSlots = useCallback(async (nextServiceId: string, nextDate: string) => {
    if (!nextServiceId || !nextDate) {
      setSlots([]);
      setSelected(null);
      return;
    }

    setLoadingSlots(true);
    setError("");
    try {
      const response = await fetch(
        `/api/availability?slug=${encodeURIComponent(slug)}&serviceId=${encodeURIComponent(nextServiceId)}&date=${encodeURIComponent(nextDate)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => ({}))) as ApiError & { slots?: Slot[] };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar horários.");
      setSlots(body.slots || []);
      setSelected(null);
    } catch (cause) {
      setSlots([]);
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "Falha ao carregar horários.");
    } finally {
      setLoadingSlots(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadSlots(serviceId, date);
  }, [serviceId, date, loadSlots]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("Escolha um horário.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId,
          startsAt: selected.starts_at,
          clientName: form.get("name"),
          clientPhone: form.get("phone"),
          clientEmail: form.get("email"),
          notes: form.get("notes"),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as ApiError & {
        appointmentId?: string;
        cancelUrl?: string;
      };

      if (!response.ok) {
        if (response.status === 409 && body.code && refreshableConflicts.has(body.code)) {
          await loadSlots(serviceId, date);
        }
        setError(body.error || "Não foi possível reservar. Atualize os horários e tente novamente.");
        return;
      }

      if (!body.appointmentId || !body.cancelUrl) {
        setError("A reserva foi processada, mas não foi possível carregar a confirmação.");
        return;
      }

      setSuccess({ id: body.appointmentId, cancelUrl: body.cancelUrl });
    } finally {
      setSubmitting(false);
    }
  }

  if (!services.length) {
    return (
      <div className="card">
        <h2>Nenhum serviço disponível</h2>
        <p className="muted">Este profissional ainda não possui serviços ativos para agendamento online.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card" aria-live="polite">
        <h2>Agendamento confirmado ✅</h2>
        <p>Seu horário está reservado. Guarde o link abaixo caso precise cancelar.</p>
        <a className="button secondary" href={success.cancelUrl}>Abrir link de cancelamento</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Serviço
        <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} · {service.duration_minutes} min · {(service.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </option>
          ))}
        </select>
      </label>

      <label>
        Data
        <input type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>

      <div>
        <strong>Horários disponíveis</strong>
        <div className="slot-grid" style={{ marginTop: 8 }}>
          {loadingSlots && <span className="muted">Carregando...</span>}
          {!loadingSlots && date && !slots.length && <span className="muted">Nenhum horário disponível nesta data.</span>}
          {slots.map((slot) => (
            <button
              type="button"
              key={slot.starts_at}
              className={selected?.starts_at === slot.starts_at ? "selected" : ""}
              onClick={() => setSelected(slot)}
              aria-pressed={selected?.starts_at === slot.starts_at}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        <label>
          Nome
          <input name="name" required maxLength={120} autoComplete="name" />
        </label>
        <label>
          WhatsApp
          <input name="phone" type="tel" inputMode="tel" required minLength={8} maxLength={30} autoComplete="tel" />
        </label>
        <label>
          E-mail (opcional)
          <input name="email" type="email" maxLength={200} autoComplete="email" />
        </label>
      </div>

      <label>
        Observação (opcional)
        <textarea name="notes" maxLength={500} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={submitting || loadingSlots || !selected}>
        {submitting ? "Confirmando..." : "Confirmar agendamento"}
      </button>
    </form>
  );
}
