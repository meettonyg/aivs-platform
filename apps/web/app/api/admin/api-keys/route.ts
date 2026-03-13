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
    where.label = { contains: search, mode: 'insensitive' };
  }

  const orderBy = buildOrderBy(sort, order, ['label', 'rateLimit', 'lastUsedAt', 'createdAt']);

  const [keys, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        label: true,
        rateLimit: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.apiKey.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: keys,
    pagination: paginationMeta(total, page, limit),
  });
}
