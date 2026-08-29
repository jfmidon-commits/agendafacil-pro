import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const makeAppointment = Boolean(process.env.MAKE_APPOINTMENT_WEBHOOK_URL);
  const makeReminder = Boolean(process.env.MAKE_REMINDER_WEBHOOK_URL);

  return NextResponse.json({
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    make: {
      appointment: makeAppointment,
      reminder: makeReminder,
      reminderEffective: makeReminder || makeAppointment,
      billing: Boolean(process.env.MAKE_BILLING_WEBHOOK_URL),
    },
    stripe: {
      secret: Boolean(process.env.STRIPE_SECRET_KEY),
      webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      proMonthly: Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY),
      proAnnual: Boolean(process.env.STRIPE_PRICE_PRO_ANNUAL),
      studioMonthly: Boolean(process.env.STRIPE_PRICE_STUDIO_MONTHLY),
    },
  });
}
