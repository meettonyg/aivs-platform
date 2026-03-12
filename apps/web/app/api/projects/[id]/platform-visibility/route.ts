import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { estimatePlatformVisibility, analyzeDomainAuthority } from '@aivs/scanner-engine';
import type { SubScores, LayerScores } from '@aivs/types';

/**
 * GET /api/projects/[id]/platform-visibility
 *
 * Returns platform-specific AI visibility estimates for the project,
 * including off-site authority data (cached per domain, 30-day TTL).
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

    // Get latest scan for this project (homepage preferred)
    const latestScan = await prisma.scan.findFirst({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestScan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No scans found for this project' } },
        { status: 404 },
      );
    }

    // Fetch domain authority (cached, 30-day TTL)
    let authorityScore = 0;
    let authorityData = null;
    const isPro = ['pro', 'agency', 'enterprise'].includes(project.organization.planTier);

    if (isPro) {
      try {
        authorityData = await analyzeDomainAuthority(project.domain);
        authorityScore = authorityData.overallAuthorityScore;
      } catch {
        // Authority analysis failed — continue without it
      }
    }

    const result = estimatePlatformVisibility({
      subScores: latestScan.subScores as unknown as SubScores,
      layerScores: latestScan.layerScores as unknown as LayerScores,
      extraction: latestScan.extraction as Record<string, unknown>,
      pageType: latestScan.pageType ?? 'page',
      authorityScore,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        domainAuthority: authorityData,
        basedOnScan: {
          id: latestScan.id,
          url: latestScan.url,
          score: latestScan.score,
          scannedAt: latestScan.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Platform visibility error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to compute platform visibility' } },
      { status: 500 },
    );
  }
}
