import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { analyzeDomainAuthority, clearAuthorityCache } from '@aivs/scanner-engine';

/**
 * GET /api/projects/[id]/authority — Get domain authority data (org + people)
 * POST /api/projects/[id]/authority — Force refresh authority data
 *
 * Pro+ only. Results cached for 30 days per domain.
 * Returns two-tier model: org authority + individual person authority.
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
      include: {
        organization: { include: { members: true } },
        people: true,
      },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    const isPro = ['pro', 'agency', 'enterprise'].includes(project.organization.planTier);
    if (!isPro) {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Pro plan or above required for authority analysis' } },
        { status: 403 },
      );
    }

    const personNames = project.people.map((p) => p.name);
    const authorityData = await analyzeDomainAuthority(project.domain, personNames);

    // Merge persisted attributions into results
    const attributions = await prisma.attribution.findMany({
      where: { projectId: id },
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: project.domain,
        people: project.people,
        attributions,
        ...authorityData,
      },
    });
  } catch (error) {
    console.error('Authority error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to analyze domain authority' } },
      { status: 500 },
    );
  }
}

export async function POST(
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
      include: {
        organization: { include: { members: true } },
        people: true,
      },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    // Clear cache and re-fetch
    await clearAuthorityCache(project.domain);
    const personNames = project.people.map((p) => p.name);
    const authorityData = await analyzeDomainAuthority(project.domain, personNames);

    return NextResponse.json({
      success: true,
      data: {
        domain: project.domain,
        refreshed: true,
        ...authorityData,
      },
    });
  } catch (error) {
    console.error('Authority refresh error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to refresh authority data' } },
      { status: 500 },
    );
  }
}
