import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
      },
      projects: {
        select: {
          id: true,
          name: true,
          domain: true,
          siteScore: true,
          siteTier: true,
          createdAt: true,
          _count: { select: { scans: true, crawlJobs: true } },
        },
      },
      apiKeys: {
        select: { id: true, label: true, rateLimit: true, scopes: true, lastUsedAt: true, createdAt: true },
      },
      webhooks: {
        select: { id: true, url: true, events: true, active: true, failureCount: true, lastTriggeredAt: true },
      },
      _count: { select: { members: true, projects: true } },
    },
  });

  if (!org) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: org });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.planTier && ['free', 'pro', 'agency', 'enterprise'].includes(body.planTier)) {
    updates.planTier = body.planTier;
  }
  if (typeof body.crawlCreditsRemaining === 'number') {
    updates.crawlCreditsRemaining = body.crawlCreditsRemaining;
  }
  if (typeof body.crawlCreditsMonthly === 'number') {
    updates.crawlCreditsMonthly = body.crawlCreditsMonthly;
  }
  if (typeof body.name === 'string') {
    updates.name = body.name;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } }, { status: 400 });
  }

  const org = await prisma.organization.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, planTier: true, crawlCreditsRemaining: true, crawlCreditsMonthly: true },
  });

  return NextResponse.json({ success: true, data: org });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  await prisma.organization.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
