"use client";

import { useActionState, useState } from "react";
import { BusinessSettingsState, saveBusinessSettings } from "./actions";

type Props = {
  initialName: string;
  initialPhone: string;
  initialBusinessName: string;
  initialSlug: string;
  initialDescription: string;
  initialCity: string;
  appUrl: string;
};

const emptyState: BusinessSettingsState = { error: null, success: null };

export default function BusinessSettingsForm(props: Props) {
  const [state, formAction, pending] = useActionState(saveBusinessSettings, emptyState);
  const [slug, setSlug] = useState(props.initialSlug);
  const base = props.appUrl.replace(/\/$/, "");
  const publicUrl = `${base}/${slug || "seu-link"}`;

  return (
    <form action={formAction} className="stack">
      <div className="grid">
        <label>
          Seu nome profissional
          <input name="name" defaultValue={props.initialName} required maxLength={120} />
        </label>
        <label>
          Telefone / WhatsApp
          <input
            name="phone"
            defaultValue={props.initialPhone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="51999999999"
            required
            maxLength={20}
          />
        </label>
      </div>

      <label>
        Nome do negócio
        <input name="businessName" defaultValue={props.initialBusinessName} required maxLength={120} />
      </label>

      <label>
        Link público
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

      <label>
        Descrição pública
        <textarea
          name="description"
          defaultValue={props.initialDescription}
          maxLength={500}
          rows={4}
          placeholder="Ex.: Barbearia especializada em cortes masculinos e barba."
        />
      </label>

      <label>
        Cidade
        <input name="city" defaultValue={props.initialCity} maxLength={120} placeholder="Viamão - RS" />
      </label>

      <p className="muted">
        Alterar estes dados não modifica seus serviços, horários, bloqueios ou agendamentos existentes.
      </p>

      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">{state.success}</p>}
      <button disabled={pending}>{pending ? "Salvando..." : "Salvar configurações"}</button>
    </form>
  );
}
