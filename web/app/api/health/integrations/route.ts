import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { getMakeConfigurationStatus } from "@/lib/integrations/make";
import { getStripeCatalogStatus } from "@/lib/stripe";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [make, stripeCatalog] = await Promise.all([
    getMakeConfigurationStatus(),
    getStripeCatalogStatus(),
  ]);

  return NextResponse.json({
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    make,
    stripe: {
      secret: Boolean(process.env.STRIPE_SECRET_KEY),
      webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      proMonthly: stripeCatalog.proMonthly,
      proAnnual: stripeCatalog.proAnnual,
      studioMonthly: stripeCatalog.studioMonthly,
    },
  });
}
