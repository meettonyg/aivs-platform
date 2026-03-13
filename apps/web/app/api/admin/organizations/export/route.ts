import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';
import { toCsv } from '@/lib/admin-utils';

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      planTier: true,
      stripeSubscriptionId: true,
      crawlCreditsMonthly: true,
      crawlCreditsRemaining: true,
      parentOrgId: true,
      createdAt: true,
      _count: { select: { members: true, projects: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    planTier: o.planTier,
    hasSubscription: o.stripeSubscriptionId ? 'Yes' : 'No',
    members: o._count.members,
    projects: o._count.projects,
    creditsRemaining: o.crawlCreditsRemaining,
    creditsMonthly: o.crawlCreditsMonthly,
    isAgencyChild: o.parentOrgId ? 'Yes' : 'No',
    createdAt: o.createdAt.toISOString(),
  }));

  const csv = toCsv(rows, [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'slug', label: 'Slug' },
    { key: 'planTier', label: 'Plan Tier' },
    { key: 'hasSubscription', label: 'Has Subscription' },
    { key: 'members', label: 'Members' },
    { key: 'projects', label: 'Projects' },
    { key: 'creditsRemaining', label: 'Credits Remaining' },
    { key: 'creditsMonthly', label: 'Credits Monthly' },
    { key: 'isAgencyChild', label: 'Agency Child' },
    { key: 'createdAt', label: 'Created At' },
  ]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="organizations-export.csv"',
    },
  });
}
