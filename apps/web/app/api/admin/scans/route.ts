import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, search, sort, order, skip } = parsePaginationParams(req);
  const url = new URL(req.url);
  const tierFilter = url.searchParams.get('tier') ?? '';
  const view = url.searchParams.get('view') ?? 'list'; // list | analytics

  if (view === 'analytics') {
    return getAnalytics();
  }

  const where: Record<string, unknown> = {};

  if (search) {
    where.url = { contains: search, mode: 'insensitive' };
  }

  if (tierFilter) {
    where.tier = tierFilter;
  }

  const orderBy = buildOrderBy(sort, order, ['url', 'score', 'tier', 'createdAt']);

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      select: {
        id: true,
        url: true,
        score: true,
        tier: true,
        factorVersion: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
            domain: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.scan.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: scans,
    pagination: paginationMeta(total, page, limit),
  });
}

async function getAnalytics() {
  const [scoreDistribution, tierAverages, totalScans] = await Promise.all([
    // Score distribution in buckets of 10
    prisma.scan.groupBy({
      by: ['tier'],
      _avg: { score: true },
      _count: { id: true },
    }),

    // Average scores by tier
    prisma.scan.groupBy({
      by: ['tier'],
      _avg: { score: true },
      _count: { id: true },
      _min: { score: true },
      _max: { score: true },
    }),

    prisma.scan.count(),
  ]);

  // Build score distribution histogram
  const allScans = await prisma.scan.findMany({
    select: { score: true },
    take: 10000, // Limit for performance
    orderBy: { createdAt: 'desc' },
  });

  const histogram: { range: string; count: number }[] = [];
  for (let i = 0; i < 100; i += 10) {
    const count = allScans.filter((s) => s.score >= i && s.score < i + 10).length;
    histogram.push({ range: `${i}-${i + 9}`, count });
  }

  return NextResponse.json({
    success: true,
    data: {
      totalScans,
      scoreDistribution: histogram,
      tierAverages: tierAverages.map((t) => ({
        tier: t.tier,
        avgScore: Math.round(t._avg.score ?? 0),
        count: t._count.id,
        minScore: t._min.score,
        maxScore: t._max.score,
      })),
    },
  });
}
