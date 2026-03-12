import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PLAN_CREDITS: Record<string, { tier: string; credits: number }> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? 'pro']: { tier: 'pro', credits: 5000 },
  [process.env.STRIPE_AGENCY_PRICE_ID ?? 'agency']: { tier: 'agency', credits: 25000 },
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

      const priceId = subscription.items.data[0]?.price?.id;
      const planInfo = priceId ? PLAN_CREDITS[priceId] : undefined;

      if (planInfo) {
        await prisma.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            planTier: planInfo.tier,
            stripeSubscriptionId: subscription.id,
            crawlCreditsMonthly: planInfo.credits,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

      await prisma.organization.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          planTier: 'free',
          stripeSubscriptionId: null,
          crawlCreditsMonthly: 5,
          crawlCreditsRemaining: 5,
        },
      });
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : (invoice.customer as Stripe.Customer)?.id;

      if (customerId) {
        // Reset credits on successful payment (new billing cycle)
        const org = await prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (org) {
          await prisma.organization.update({
            where: { id: org.id },
            data: { crawlCreditsRemaining: org.crawlCreditsMonthly },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
