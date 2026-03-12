import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * GET /api/webhooks — List webhooks
 * POST /api/webhooks — Create a webhook
 * DELETE /api/webhooks?id=xxx — Delete a webhook
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId!, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: { organizationId: membership.organizationId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        failureCount: true,
        lastTriggeredAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: webhooks });
  } catch (error) {
    console.error('Webhooks list error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to list webhooks' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId!, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const tier = membership.organization.planTier;
    if (tier !== 'agency' && tier !== 'enterprise') {
      return NextResponse.json({ success: false, error: { code: 'PLAN_REQUIRED', message: 'Agency or Enterprise plan required for webhooks' } }, { status: 403 });
    }

    const body = await request.json();
    const { url, events } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'url is required' } }, { status: 400 });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid URL format' } }, { status: 400 });
    }

    const validEvents = ['scan.complete', 'score.changed', 'crawl.complete', 'credits.low', 'tier.changed', 'alert.created'];
    const selectedEvents = Array.isArray(events) ? events.filter((e: string) => validEvents.includes(e)) : validEvents;

    const secret = randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: membership.organizationId,
        url,
        events: selectedEvents,
        secret,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        secret, // Only shown once at creation
      },
    });
  } catch (error) {
    console.error('Webhook create error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to create webhook' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const webhookId = request.nextUrl.searchParams.get('id');
    if (!webhookId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'id is required' } }, { status: 400 });
    }

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { organization: { include: { members: true } } },
    });

    if (!webhook || !webhook.organization.members.some((m) => m.userId === userId && ['owner', 'admin'].includes(m.role))) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    await prisma.webhook.delete({ where: { id: webhookId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook delete error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to delete webhook' } }, { status: 500 });
  }
}
