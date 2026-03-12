import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/agency/dashboard — Aggregate cross-client dashboard
 *
 * Returns summary stats across all projects (and sub-orgs) for agency accounts.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
        { status: 401 },
      );
    }

    // Get user's org
    const membership = await prisma.orgMember.findFirst({
      where: { userId, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const org = membership.organization;

    if (org.planTier !== 'agency' && org.planTier !== 'enterprise') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Agency or Enterprise plan required' } },
        { status: 403 },
      );
    }

    // Get all org IDs (parent + child orgs for agency)
    const childOrgs = await prisma.organization.findMany({
      where: { parentOrgId: org.id },
      select: { id: true, name: true, slug: true },
    });

    const orgIds = [org.id, ...childOrgs.map((c) => c.id)];

    // Get all projects across orgs
    const projects = await prisma.project.findMany({
      where: { organizationId: { in: orgIds } },
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { scans: true, crawlJobs: true } },
      },
    });

    // Aggregate stats
    const totalProjects = projects.length;
    const projectsWithScore = projects.filter((p) => p.siteScore !== null);
    const avgSiteScore = projectsWithScore.length > 0
      ? Math.round(projectsWithScore.reduce((s, p) => s + (p.siteScore ?? 0), 0) / projectsWithScore.length)
      : 0;

    const tierBreakdown = {
      authority: projectsWithScore.filter((p) => (p.siteScore ?? 0) >= 90).length,
      extractable: projectsWithScore.filter((p) => (p.siteScore ?? 0) >= 70 && (p.siteScore ?? 0) < 90).length,
      readable: projectsWithScore.filter((p) => (p.siteScore ?? 0) >= 40 && (p.siteScore ?? 0) < 70).length,
      invisible: projectsWithScore.filter((p) => (p.siteScore ?? 0) < 40).length,
    };

    // Recent crawl activity
    const recentCrawls = await prisma.crawlJob.findMany({
      where: { project: { organizationId: { in: orgIds } } },
      include: { project: { select: { domain: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Credits summary
    const totalCreditsRemaining = await prisma.organization.aggregate({
      where: { id: { in: orgIds } },
      _sum: { crawlCreditsRemaining: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalProjects,
          totalClients: childOrgs.length,
          avgSiteScore,
          tierBreakdown,
          totalCreditsRemaining: totalCreditsRemaining._sum.crawlCreditsRemaining ?? 0,
        },
        projects: projects.map((p) => ({
          id: p.id,
          domain: p.domain,
          name: p.name,
          siteScore: p.siteScore,
          siteTier: p.siteTier,
          organization: p.organization,
          scanCount: p._count.scans,
          crawlCount: p._count.crawlJobs,
          lastScheduledAt: p.lastScheduledAt,
        })),
        recentCrawls: recentCrawls.map((c) => ({
          id: c.id,
          domain: c.project.domain,
          status: c.status,
          pagesCompleted: c.pagesCompleted,
          siteScore: c.siteScore,
          completedAt: c.completedAt,
        })),
        childOrgs,
      },
    });
  } catch (error) {
    console.error('Agency dashboard error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to load dashboard' } },
      { status: 500 },
    );
  }
}
