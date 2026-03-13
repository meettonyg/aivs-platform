import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, sort, order, skip } = parsePaginationParams(req);
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') ?? '';

  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = statusFilter;
  }

  const orderBy = buildOrderBy(sort, order, ['status', 'pagesTotal', 'pagesCompleted', 'creditsUsed', 'createdAt']);

  const [jobs, total, queueStats] = await Promise.all([
    prisma.crawlJob.findMany({
      where,
      select: {
        id: true,
        status: true,
        pagesTotal: true,
        pagesCompleted: true,
        pagesSkipped: true,
        creditsUsed: true,
        isIncremental: true,
        siteScore: true,
        startedAt: true,
        completedAt: true,
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
    prisma.crawlJob.count({ where }),
    Promise.all([
      prisma.crawlJob.count({ where: { status: 'pending' } }),
      prisma.crawlJob.count({ where: { status: 'running' } }),
      prisma.crawlJob.count({ where: { status: 'failed' } }),
      prisma.crawlJob.count({ where: { status: 'completed' } }),
    ]),
  ]);

  return NextResponse.json({
    success: true,
    data: jobs,
    pagination: paginationMeta(total, page, limit),
    queueStats: {
      pending: queueStats[0],
      running: queueStats[1],
      failed: queueStats[2],
      completed: queueStats[3],
    },
  });
}
