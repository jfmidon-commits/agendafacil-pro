import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BillingActions from "./billing-actions";

const statusLabels: Record<string, string> = {
  active: "ativa",
  trialing: "em período de teste",
  past_due: "pagamento pendente",
  unpaid: "pagamento não concluído",
  incomplete: "aguardando pagamento",
  incomplete_expired: "checkout expirado",
  paused: "pausada",
  canceled: "cancelada",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/billing");

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("trial_status,trial_ends_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end,cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const query = await searchParams;
  const trialActive = Boolean(
    profile?.trial_status === "active" &&
      profile.trial_ends_at &&
      new Date(profile.trial_ends_at) > new Date(),
  );
  const manageableSubscription = Boolean(
    subscription && !["canceled", "incomplete_expired"].includes(subscription.status),
  );
  const planLabel = subscription
    ? `${subscription.plan === "pro-annual" ? "Pro anual" : "Pro mensal"} · ${statusLabels[subscription.status] || subscription.status}`
    : trialActive
      ? "Trial Pro"
      : "Free";

  return (
    <main>
      <h1>Plano e cobrança</h1>
      {query.checkout === "success" && (
        <p className="success">
          Checkout concluído. O status do plano será atualizado após a confirmação do pagamento.
        </p>
      )}
      {query.checkout === "cancelled" && (
        <p className="muted">Checkout cancelado. Nenhuma nova cobrança foi concluída.</p>
      )}
      <div className="card">
        <p><strong>Assinatura:</strong> {planLabel}</p>
        {trialActive && profile?.trial_ends_at && (
          <p className="muted">Trial até {new Date(profile.trial_ends_at).toLocaleDateString("pt-BR")}.</p>
        )}
        {subscription?.current_period_end && (
          <p className="muted">
            Período atual até {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
            {subscription.cancel_at_period_end ? " · cancelamento agendado" : ""}.
          </p>
        )}
        {subscription?.status === "past_due" && (
          <p className="error">Existe um pagamento pendente. Use o portal para atualizar a forma de pagamento.</p>
        )}
        <BillingActions hasSubscription={manageableSubscription} />
      </div>
    </main>
  );
}
