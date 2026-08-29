import { createClient } from "@/lib/supabase/server";
import {
  addAvailabilityRule,
  deleteAvailabilityRule,
  deleteScheduleBlock,
} from "./actions";
import BlockForm from "./block-form";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const [{ data: rules }, { data: blocks }] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("id,day_of_week,start_time,end_time,slot_interval_minutes")
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("schedule_blocks")
      .select("id,starts_at,ends_at,type,reason")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(20),
  ]);

  return (
    <main>
      <h1>Horários e bloqueios</h1>
      <div className="grid">
        <div className="card">
          <h2>Regra semanal</h2>
          <form action={addAvailabilityRule} className="stack">
            <label>
              Dia
              <select name="day">
                {dayNames.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </label>
            <div className="grid">
              <label>
                Início
                <input type="time" name="start" defaultValue="09:00" required />
              </label>
              <label>
                Fim
                <input type="time" name="end" defaultValue="18:00" required />
              </label>
              <label>
                Intervalo de slots
                <select name="interval" defaultValue="30">
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                </select>
              </label>
            </div>
            <button>Adicionar regra</button>
          </form>

          <hr />
          <div className="stack">
            {!rules?.length && <p className="muted">Nenhuma regra semanal configurada.</p>}
            {rules?.map((rule) => (
              <div key={rule.id} className="row">
                <div>
                  <strong>{dayNames[rule.day_of_week]}</strong>{" "}
                  {String(rule.start_time).slice(0, 5)}–{String(rule.end_time).slice(0, 5)}{" "}
                  <span className="muted">slots {rule.slot_interval_minutes} min</span>
                </div>
                <form action={deleteAvailabilityRule}>
                  <input type="hidden" name="id" value={rule.id} />
                  <button className="secondary">Remover</button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Bloqueio pontual</h2>
          <p className="muted">Use para almoço, compromisso, folga ou qualquer período que não deve aceitar reservas.</p>
          <BlockForm />
          <hr />
          <div className="stack">
            {!blocks?.length && <p className="muted">Nenhum bloqueio futuro.</p>}
            {blocks?.map((block) => (
              <div key={block.id} className="row">
                <div>
                  <strong>{new Date(block.starts_at).toLocaleString("pt-BR")}</strong>{" → "}
                  {new Date(block.ends_at).toLocaleString("pt-BR")}
                  <div className="muted">
                    {block.type}{block.reason ? ` · ${block.reason}` : ""}
                  </div>
                </div>
                <form action={deleteScheduleBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <button className="secondary">Remover</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
