import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalOrgs,
    totalScans,
    activeSubscriptions,
    recentUsers,
    recentScans,
    planBreakdown,
    topDomains,
    failedJobs,
    runningJobs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.scan.count(),
    prisma.organization.count({ where: { stripeSubscriptionId: { not: null } } }),

    // New signups per day (last 30 days)
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Scans per day (last 30 days)
    prisma.scan.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Subscription breakdown by plan tier
    prisma.organization.groupBy({
      by: ['planTier'],
      _count: { id: true },
    }),

    // Top 10 most scanned domains
    prisma.scan.groupBy({
      by: ['url'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),

    // Failed jobs count
    prisma.crawlJob.count({ where: { status: 'failed' } }),

    // Running jobs count (queue depth proxy)
    prisma.crawlJob.count({ where: { status: { in: ['pending', 'running'] } } }),
  ]);

  // Aggregate signups by day
  const signupsByDay = aggregateByDay(
    recentUsers.map((u) => u.createdAt),
    thirtyDaysAgo,
    now,
  );

  // Aggregate scans by day
  const scansByDay = aggregateByDay(
    recentScans.map((s) => s.createdAt),
    thirtyDaysAgo,
    now,
  );

  // MRR estimate (plan prices)
  const planPrices: Record<string, number> = { free: 0, pro: 49, agency: 199, enterprise: 499 };
  const mrr = planBreakdown.reduce((sum, p) => {
    return sum + (planPrices[p.planTier] ?? 0) * p._count.id;
  }, 0);

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      totalOrgs,
      totalScans,
      activeSubscriptions,
      mrr,
      signupsByDay,
      scansByDay,
      planBreakdown: planBreakdown.map((p) => ({ name: p.planTier, count: p._count.id })),
      topDomains: topDomains.map((d) => ({ url: d.url, count: d._count.id })),
      systemHealth: {
        queueDepth: runningJobs,
        failedJobs,
      },
    },
  });
}

function aggregateByDay(dates: Date[], start: Date, end: Date) {
  const counts: Record<string, number> = {};
  // Initialize all days
  const current = new Date(start);
  while (current <= end) {
    counts[current.toISOString().slice(0, 10)] = 0;
    current.setDate(current.getDate() + 1);
  }
  // Count
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}
