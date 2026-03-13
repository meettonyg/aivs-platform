import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { toCsv } from '@/lib/admin-utils';

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: { select: { name: true, planTier: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? '',
    role: u.role,
    organizations: u.memberships.map((m) => `${m.organization.name} (${m.role})`).join('; '),
    planTier: u.memberships[0]?.organization.planTier ?? '',
    createdAt: u.createdAt.toISOString(),
  }));

  const csv = toCsv(rows, [
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'organizations', label: 'Organizations' },
    { key: 'planTier', label: 'Plan Tier' },
    { key: 'createdAt', label: 'Created At' },
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="users-export.csv"',
    },
  });
}
