import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { getStripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { plan } = body;

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Invalid plan' } },
      { status: 400 },
    );
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId, role: { in: ['owner', 'admin'] } },
    include: { organization: true },
  });

  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You must be an org owner or admin' } },
      { status: 403 },
    );
  }

  const org = membership.organization;

  // Create or get Stripe customer
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const customer = await getStripe().customers.create({
      email: user?.email ?? undefined,
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create checkout session
  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?billing=cancelled`,
  });

  return NextResponse.json({ success: true, data: { url: checkoutSession.url } });
}
