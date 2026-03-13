import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { parsePaginationParams, paginationMeta, buildOrderBy } from '@/lib/admin-utils';

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { page, limit, search, sort, order, skip } = parsePaginationParams(req);
  const url = new URL(req.url);
  const roleFilter = url.searchParams.get('role') ?? '';
  const planFilter = url.searchParams.get('plan') ?? '';

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (roleFilter) {
    where.role = roleFilter;
  }

  if (planFilter) {
    where.memberships = { some: { organization: { planTier: planFilter } } };
  }

  const orderBy = buildOrderBy(sort, order, ['email', 'name', 'role', 'createdAt']);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, planTier: true } },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    pagination: paginationMeta(total, page, limit),
  });
}
