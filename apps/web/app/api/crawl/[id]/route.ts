import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/crawl/[id] — Get crawl job status and results
 */
export async function GET(
  _request: NextRequest,
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

    const crawlJob = await prisma.crawlJob.findUnique({
      where: { id },
      include: {
        project: {
          include: { organization: { include: { members: true } } },
        },
        scans: {
          select: {
            id: true,
            url: true,
            score: true,
            tier: true,
            pageType: true,
            createdAt: true,
          },
          orderBy: { score: 'desc' },
        },
      },
    });

    if (!crawlJob) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Crawl job not found' } },
        { status: 404 },
      );
    }

    // Verify access
    if (!crawlJob.project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: crawlJob.id,
        projectId: crawlJob.projectId,
        status: crawlJob.status,
        pagesTotal: crawlJob.pagesTotal,
        pagesCompleted: crawlJob.pagesCompleted,
        pagesSkipped: crawlJob.pagesSkipped,
        creditsUsed: crawlJob.creditsUsed,
        isIncremental: crawlJob.isIncremental,
        siteScore: crawlJob.siteScore,
        deltaReport: crawlJob.deltaReport,
        startedAt: crawlJob.startedAt,
        completedAt: crawlJob.completedAt,
        scans: crawlJob.scans,
      },
    });
  } catch (error) {
    console.error('Crawl status error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to get crawl status' } },
      { status: 500 },
    );
  }
}
