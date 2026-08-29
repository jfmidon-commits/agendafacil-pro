import { createClient } from "@/lib/supabase/server";
import { createService, toggleService, updateService } from "./actions";

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id,name,duration_minutes,buffer_before,buffer_after,price_cents,active")
    .order("created_at");

  return (
    <main>
      <h1>Serviços</h1>
      <div className="grid">
        <div className="card">
          <h2>Novo serviço</h2>
          <form action={createService} className="stack">
            <label>
              Nome
              <input name="name" required minLength={2} maxLength={100} />
            </label>
            <div className="grid">
              <label>
                Duração
                <input type="number" name="duration" defaultValue="30" min="5" max="720" required />
              </label>
              <label>
                Buffer antes
                <input type="number" name="bufferBefore" defaultValue="0" min="0" max="240" required />
              </label>
              <label>
                Buffer depois
                <input type="number" name="bufferAfter" defaultValue="0" min="0" max="240" required />
              </label>
              <label>
                Preço R$
                <input type="number" step="0.01" name="price" defaultValue="0" min="0" required />
              </label>
            </div>
            <button>Adicionar serviço</button>
          </form>
        </div>

        <div className="card">
          <h2>Cadastrados</h2>
          <p className="muted">Edite preço, duração e buffers sem recriar o serviço. Desativar preserva o histórico.</p>
          <div className="stack">
            {!services?.length && <p className="muted">Nenhum serviço cadastrado.</p>}
            {services?.map((service) => (
              <div key={service.id} className="card">
                <div className="row">
                  <strong>{service.name}</strong>
                  <span className="badge">{service.active ? "Ativo" : "Inativo"}</span>
                </div>

                <form action={updateService.bind(null, service.id)} className="stack">
                  <label>
                    Nome
                    <input name="name" defaultValue={service.name} required minLength={2} maxLength={100} />
                  </label>
                  <div className="grid">
                    <label>
                      Duração
                      <input
                        type="number"
                        name="duration"
                        defaultValue={service.duration_minutes}
                        min="5"
                        max="720"
                        required
                      />
                    </label>
                    <label>
                      Buffer antes
                      <input
                        type="number"
                        name="bufferBefore"
                        defaultValue={service.buffer_before}
                        min="0"
                        max="240"
                        required
                      />
                    </label>
                    <label>
                      Buffer depois
                      <input
                        type="number"
                        name="bufferAfter"
                        defaultValue={service.buffer_after}
                        min="0"
                        max="240"
                        required
                      />
                    </label>
                    <label>
                      Preço R$
                      <input
                        type="number"
                        step="0.01"
                        name="price"
                        defaultValue={money(service.price_cents)}
                        min="0"
                        required
                      />
                    </label>
                  </div>
                  <button>Salvar alterações</button>
                </form>

                <form action={toggleService.bind(null, service.id, !service.active)}>
                  <button className="secondary">
                    {service.active ? "Desativar serviço" : "Ativar serviço"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
