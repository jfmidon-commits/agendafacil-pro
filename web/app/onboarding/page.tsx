import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./form";

type Rule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
};

function compactTime(value: string) {
  return value.slice(0, 5);
}

function groupRules(rules: Rule[]) {
  const grouped = new Map<string, { days: number[]; startTime: string; endTime: string }>();

  for (const rule of rules) {
    const startTime = compactTime(rule.start_time);
    const endTime = compactTime(rule.end_time);
    const key = `${startTime}|${endTime}`;
    const current = grouped.get(key) || { days: [], startTime, endTime };
    if (!current.days.includes(rule.day_of_week)) current.days.push(rule.day_of_week);
    grouped.set(key, current);
  }

  return [...grouped.values()].map((group) => ({ ...group, days: group.days.sort((a, b) => a - b) }));
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: service }, { data: rules }] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("business_name,slug")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("services")
      .select("name,duration_minutes,price_cents")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("availability_rules")
      .select("day_of_week,start_time,end_time,slot_interval_minutes")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("day_of_week")
      .order("start_time"),
  ]);

  const initialSchedule = rules?.length
    ? groupRules(rules as Rule[])
    : [
        { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "18:00" },
        { days: [6], startTime: "09:00", endTime: "14:00" },
      ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <main>
      <div className="card" style={{ maxWidth: 820, margin: "20px auto" }}>
        <span className="badge">Configuração inicial</span>
        <h1>Seu link em poucos passos</h1>
        <p className="muted">Configure o básico agora. Você poderá voltar e editar esses dados quando precisar.</p>
        <OnboardingForm
          initialBusinessName={profile?.business_name || ""}
          initialSlug={profile?.slug || ""}
          initialServiceName={service?.name || "Corte"}
          initialDuration={service?.duration_minutes || 30}
          initialPrice={(service?.price_cents || 0) / 100}
          initialSlotInterval={rules?.[0]?.slot_interval_minutes || 30}
          initialSchedule={initialSchedule}
          appUrl={appUrl}
        />
      </div>
    </main>
  );
}
