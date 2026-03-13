import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, search, sort, order, skip } = parsePaginationParams(req);

  const where: Record<string, unknown> = {};
  if (search) {
    where.url = { contains: search, mode: 'insensitive' };
  }

  const orderBy = buildOrderBy(sort, order, ['url', 'active', 'failureCount', 'createdAt']);

  const [webhooks, total] = await Promise.all([
    prisma.webhook.findMany({
      where,
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        failureCount: true,
        lastTriggeredAt: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.webhook.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: webhooks,
    pagination: paginationMeta(total, page, limit),
  });
}
