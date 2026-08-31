import Stripe from "stripe";
import { NextResponse } from "next/server";
import { postBillingEvent } from "@/lib/integrations/make";
import { billingIntervalFromPrice, planFromPrice, getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

function iso(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function customerId(value: Stripe.Subscription["customer"]) {
  return typeof value === "string" ? value : value.id;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const raw =
    (invoice as unknown as { subscription?: string | Stripe.Subscription | null }).subscription ??
    (invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
    }).parent?.subscription_details?.subscription;
  return typeof raw === "string" ? raw : raw?.id || null;
}

async function resolveUserId(subscription: Stripe.Subscription) {
  if (subscription.metadata.user_id) return subscription.metadata.user_id;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (data?.user_id) return data.user_id;

  const customer = await getStripe().customers.retrieve(customerId(subscription.customer));
  if (!customer.deleted && customer.metadata.user_id) return customer.metadata.user_id;
  throw new Error("stripe_user_not_resolved");
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;
  if (!price) throw new Error("stripe_price_missing");
  const userId = await resolveUserId(subscription);
  const supabase = createServiceClient();

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId(subscription.customer) })
    .eq("id", userId);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId(subscription.customer),
      stripe_subscription_id: subscription.id,
      stripe_price_id: price.id,
      plan: planFromPrice(price),
      billing_interval: billingIntervalFromPrice(price),
      status: subscription.status,
      current_period_start: iso(
        (subscription as unknown as { current_period_start?: number }).current_period_start,
      ),
      current_period_end: iso(
        (subscription as unknown as { current_period_end?: number }).current_period_end,
      ),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return userId;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const stripe = getStripe();
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("status")
    .eq("id", event.id)
    .maybeSingle();
  if (existing?.status === "processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type, status: "processing", last_error: null }, { onConflict: "id" });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        await syncSubscription(await stripe.subscriptions.retrieve(session.subscription));
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const id = subscriptionIdFromInvoice(invoice);
      if (id) await syncSubscription(await stripe.subscriptions.retrieve(id));
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const id = subscriptionIdFromInvoice(invoice);
      if (id) {
        const sub = await stripe.subscriptions.retrieve(id);
        const userId = await syncSubscription(sub);
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", id);
        await postBillingEvent({
          event: "billing.payment_failed",
          userId,
          stripeSubscriptionId: id,
          occurredAt: new Date().toISOString(),
        }).catch(() => false);
      }
    }

    await supabase
      .from("stripe_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
      .eq("id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "stripe_processing_failed";
    await supabase
      .from("stripe_events")
      .update({ status: "error", last_error: message })
      .eq("id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
