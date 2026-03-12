import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { computeSiteScore } from '@aivs/scanner-engine';
import type { ScanFix } from '@aivs/types';

/**
 * GET /api/projects/[id]/site-score — Get aggregated site-level score
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

    // Get latest scan for each URL in this project
    const latestScans = await prisma.scan.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      distinct: ['url'],
    });

    if (latestScans.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          siteScore: project.siteScore ?? 0,
          siteTier: project.siteTier ?? 'invisible',
          totalPages: 0,
          avgScore: 0,
          pageBreakdown: { authority: 0, extractable: 0, readable: 0, invisible: 0 },
          aggregateIssues: [],
          priorityFixes: [],
          subScoreAverages: {},
        },
      });
    }

    const siteResult = computeSiteScore(
      latestScans.map((s) => ({
        url: s.url,
        score: s.score,
        tier: s.tier,
        pageType: s.pageType ?? 'page',
        subScores: (s.subScores ?? {}) as Record<string, number>,
        fixes: (s.fixes ?? []) as ScanFix[],
      })),
    );

    // Update project with latest site score
    await prisma.project.update({
      where: { id },
      data: {
        siteScore: siteResult.siteScore,
        siteTier: siteResult.siteTier,
      },
    });

    return NextResponse.json({ success: true, data: siteResult });
  } catch (error) {
    console.error('Site score error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to compute site score' } },
      { status: 500 },
    );
  }
}
