import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { PLAN_LIMITS } from '@aivs/types';

/**
 * POST /api/agency/bulk-import — Bulk import domains from CSV
 * Body: { domains: [{ domain: string, name?: string }] }
 *
 * Agency tier only.
 */
export async function POST(request: NextRequest) {
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

    // Get user's org (must be agency tier)
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
    const planLimits = PLAN_LIMITS[org.planTier as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

    if (org.planTier !== 'agency' && org.planTier !== 'enterprise') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Agency or Enterprise plan required for bulk import' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { domains } = body;

    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'domains array is required' } },
        { status: 400 },
      );
    }

    // Check domain limit
    const existingCount = await prisma.project.count({
      where: { organizationId: org.id },
    });

    const maxDomains = planLimits.maxDomains;
    const slotsRemaining = maxDomains - existingCount;

    if (slotsRemaining <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'DOMAIN_LIMIT', message: `Domain limit reached (${maxDomains})` } },
        { status: 402 },
      );
    }

    const toImport = domains.slice(0, slotsRemaining);
    const created: { id: string; domain: string; name: string }[] = [];
    const skipped: { domain: string; reason: string }[] = [];

    for (const entry of toImport) {
      const domain = String(entry.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!domain || domain.length < 3) {
        skipped.push({ domain: entry.domain, reason: 'Invalid domain' });
        continue;
      }

      // Check for duplicates
      const existing = await prisma.project.findFirst({
        where: { organizationId: org.id, domain },
      });

      if (existing) {
        skipped.push({ domain, reason: 'Already exists' });
        continue;
      }

      const name = entry.name ?? domain.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, ' ');

      const project = await prisma.project.create({
        data: {
          organizationId: org.id,
          domain,
          name,
        },
      });

      created.push({ id: project.id, domain, name });
    }

    return NextResponse.json({
      success: true,
      data: {
        created: created.length,
        skipped: skipped.length,
        truncated: domains.length > slotsRemaining ? domains.length - slotsRemaining : 0,
        projects: created,
        errors: skipped,
      },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Bulk import failed' } },
      { status: 500 },
    );
  }
}
