import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import Stripe from 'stripe';

const PLAN_CREDITS: Record<string, { tier: string; credits: number }> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? 'pro']: { tier: 'pro', credits: 5000 },
  [process.env.STRIPE_AGENCY_PRICE_ID ?? 'agency']: { tier: 'agency', credits: 25000 },
};

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }

  return stripeInstance;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
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
