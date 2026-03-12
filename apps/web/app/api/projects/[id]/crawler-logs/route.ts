import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { parseCrawlerLogs } from '@aivs/scanner-engine';

/**
 * POST /api/projects/[id]/crawler-logs — Upload and analyze server access logs
 *
 * Body: { logContent: string } (raw access log text)
 * Returns: Crawler log analysis report with bot visit breakdown.
 */
export async function POST(
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

    const tier = project.organization.planTier;
    if (tier === 'free') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Pro plan or above required for crawler log analysis' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { logContent } = body;

    if (!logContent || typeof logContent !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'logContent is required' } },
        { status: 400 },
      );
    }

    // Limit log size (10MB)
    if (logContent.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Log content exceeds 10MB limit' } },
        { status: 400 },
      );
    }

    const report = parseCrawlerLogs(logContent);

    return NextResponse.json({
      success: true,
      data: {
        domain: project.domain,
        ...report,
      },
    });
  } catch (error) {
    console.error('Crawler log error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to analyze crawler logs' } },
      { status: 500 },
    );
  }
}
