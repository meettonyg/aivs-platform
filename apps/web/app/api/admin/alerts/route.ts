import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, search, sort, order, skip } = parsePaginationParams(req);
  const url = new URL(req.url);
  const severityFilter = url.searchParams.get('severity') ?? '';

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { message: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (severityFilter) {
    where.severity = severityFilter;
  }

  const orderBy = buildOrderBy(sort, order, ['type', 'severity', 'createdAt']);

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        url: true,
        readAt: true,
        createdAt: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.alert.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: alerts,
    pagination: paginationMeta(total, page, limit),
  });
}
