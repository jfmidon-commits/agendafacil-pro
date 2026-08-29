"use client";

import { useActionState, useMemo, useState } from "react";
import { OnboardingState, saveOnboarding } from "./actions";

type ScheduleGroup = {
  days: number[];
  startTime: string;
  endTime: string;
};

type Props = {
  initialBusinessName: string;
  initialSlug: string;
  initialServiceName: string;
  initialDuration: number;
  initialPrice: number;
  initialSlotInterval: number;
  initialSchedule: ScheduleGroup[];
  appUrl: string;
};

const days = [
  [1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"],
  [5, "Sex"], [6, "Sáb"], [0, "Dom"],
] as const;

const emptyState: OnboardingState = { error: null };

export default function OnboardingForm(props: Props) {
  const [state, formAction, pending] = useActionState(saveOnboarding, emptyState);
  const [slug, setSlug] = useState(props.initialSlug);
  const [schedule, setSchedule] = useState<ScheduleGroup[]>(props.initialSchedule);

  const scheduleJson = useMemo(() => JSON.stringify(schedule), [schedule]);
  const publicUrl = `${props.appUrl.replace(/\/$/, "")}/${slug || "seu-link"}`;

  function updateGroup(index: number, patch: Partial<ScheduleGroup>) {
    setSchedule((current) => current.map((group, i) => i === index ? { ...group, ...patch } : group));
  }

  function toggleDay(index: number, day: number) {
    const group = schedule[index];
    const hasDay = group.days.includes(day);
    updateGroup(index, {
      days: hasDay ? group.days.filter((value) => value !== day) : [...group.days, day],
    });
  }

  function addGroup() {
    setSchedule((current) => [...current, { days: [], startTime: "09:00", endTime: "18:00" }]);
  }

  function removeGroup(index: number) {
    setSchedule((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="stack">
      <label>
        Nome do negócio
        <input name="businessName" defaultValue={props.initialBusinessName} required maxLength={120} />
      </label>

      <label>
        Slug do link
        <input
          name="slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="barbearia-do-joao"
          required
          maxLength={50}
        />
      </label>
      <p className="muted" style={{ marginTop: -8, wordBreak: "break-all" }}>
        Seu link: {publicUrl}
      </p>

      <div className="grid">
        <label>
          Primeiro serviço
          <input name="serviceName" defaultValue={props.initialServiceName} placeholder="Corte de cabelo" required maxLength={120} />
        </label>
        <label>
          Duração (min)
          <input name="duration" type="number" min="5" max="720" defaultValue={props.initialDuration} required />
        </label>
        <label>
          Preço (R$)
          <input name="price" type="number" min="0" step="0.01" defaultValue={props.initialPrice.toFixed(2)} required />
        </label>
        <label>
          Intervalo dos horários
          <select name="slotInterval" defaultValue={String(props.initialSlotInterval)}>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </label>
      </div>

      <section className="stack">
        <div className="row" style={{ alignItems: "center" }}>
          <div>
            <strong>Horários de atendimento</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Crie grupos diferentes, por exemplo Seg–Sex 09–18 e Sáb 09–14.
            </p>
          </div>
          <button type="button" className="secondary" onClick={addGroup} style={{ marginLeft: "auto" }}>
            + Adicionar horário
          </button>
        </div>

        {schedule.map((group, index) => (
          <div className="card" key={index} style={{ margin: 0 }}>
            <div className="row" style={{ alignItems: "center", marginBottom: 12 }}>
              <strong>Grupo {index + 1}</strong>
              {schedule.length > 1 && (
                <button type="button" className="danger" onClick={() => removeGroup(index)} style={{ marginLeft: "auto" }}>
                  Remover
                </button>
              )}
            </div>

            <div className="row" style={{ gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              {days.map(([value, label]) => (
                <label key={value} style={{ display: "flex", gap: 5, alignItems: "center", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={group.days.includes(value)}
                    onChange={() => toggleDay(index, value)}
                    style={{ width: "auto" }}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid">
              <label>
                Abre às
                <input type="time" value={group.startTime} onChange={(event) => updateGroup(index, { startTime: event.target.value })} required />
              </label>
              <label>
                Fecha às
                <input type="time" value={group.endTime} onChange={(event) => updateGroup(index, { endTime: event.target.value })} required />
              </label>
            </div>
          </div>
        ))}
      </section>

      <input type="hidden" name="scheduleJson" value={scheduleJson} />
      {state.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>{pending ? "Salvando..." : "Salvar e abrir meu painel"}</button>
    </form>
  );
}
