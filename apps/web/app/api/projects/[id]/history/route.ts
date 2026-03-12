import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/projects/[id]/history — Get scan history for trend charts
 * Query: ?url=xxx (optional, filter to specific URL)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    const { id } = await params;
    const url = request.nextUrl.searchParams.get('url');

    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: { include: { members: true } } },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    const history = await prisma.scanHistory.findMany({
      where: {
        projectId: id,
        ...(url ? { url } : {}),
      },
      orderBy: { scannedAt: 'asc' },
      take: 100,
    });

    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to get history' } },
      { status: 500 },
    );
  }
}
