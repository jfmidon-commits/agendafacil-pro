import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { getStripeCatalogStatus } from "@/lib/stripe";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const makeAppointment = Boolean(process.env.MAKE_APPOINTMENT_WEBHOOK_URL);
  const makeReminder = Boolean(process.env.MAKE_REMINDER_WEBHOOK_URL);
  const stripeCatalog = await getStripeCatalogStatus();

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
      proMonthly: stripeCatalog.proMonthly,
      proAnnual: stripeCatalog.proAnnual,
      studioMonthly: stripeCatalog.studioMonthly,
    },
  });
}
