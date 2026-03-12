import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/alerts — List alerts for the user's org
 * Query: ?unread=true, ?limit=50
 *
 * PATCH /api/alerts — Mark alerts as read
 * Body: { alertIds: string[] }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId! },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'No organization found' } }, { status: 404 });
    }

    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10), 100);

    const alerts = await prisma.alert.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.alert.count({
      where: { organizationId: membership.organizationId, readAt: null },
    });

    return NextResponse.json({
      success: true,
      data: { alerts, unreadCount },
    });
  } catch (error) {
    console.error('Alerts error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to fetch alerts' } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { alertIds } = body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'alertIds array required' } }, { status: 400 });
    }

    await prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { marked: alertIds.length } });
  } catch (error) {
    console.error('Alert mark-read error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to update alerts' } }, { status: 500 });
  }
}
