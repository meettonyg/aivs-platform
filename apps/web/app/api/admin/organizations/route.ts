import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, search, sort, order, skip } = parsePaginationParams(req);
  const url = new URL(req.url);
  const planFilter = url.searchParams.get('plan') ?? '';
  const hasSubscription = url.searchParams.get('hasSubscription');

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (planFilter) {
    where.planTier = planFilter;
  }

  if (hasSubscription === 'true') {
    where.stripeSubscriptionId = { not: null };
  } else if (hasSubscription === 'false') {
    where.stripeSubscriptionId = null;
  }

  const orderBy = buildOrderBy(sort, order, ['name', 'slug', 'planTier', 'createdAt', 'crawlCreditsRemaining']);

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        planTier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        crawlCreditsMonthly: true,
        crawlCreditsRemaining: true,
        currentPeriodEnd: true,
        parentOrgId: true,
        createdAt: true,
        _count: { select: { members: true, projects: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: orgs,
    pagination: paginationMeta(total, page, limit),
  });
}
