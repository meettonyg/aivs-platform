import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

const PLAN_PRICES: Record<string, number> = { free: 0, pro: 49, agency: 199, enterprise: 499 };

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const [planBreakdown, totalOrgs, paidOrgs, expiringOrgs, creditUsage] = await Promise.all([
    prisma.organization.groupBy({
      by: ['planTier'],
      _count: { id: true },
    }),

    prisma.organization.count(),

    prisma.organization.count({ where: { stripeSubscriptionId: { not: null } } }),

    // Orgs with subscriptions expiring in the next 7 days
    prisma.organization.findMany({
      where: {
        currentPeriodEnd: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, name: true, slug: true, planTier: true, currentPeriodEnd: true },
      orderBy: { currentPeriodEnd: 'asc' },
    }),

    // Total credit usage
    prisma.organization.aggregate({
      _sum: {
        crawlCreditsMonthly: true,
        crawlCreditsRemaining: true,
      },
    }),
  ]);

  // Calculate MRR and ARR
  const mrr = planBreakdown.reduce((sum, p) => sum + (PLAN_PRICES[p.planTier] ?? 0) * p._count.id, 0);
  const arr = mrr * 12;

  // Churn estimate: free orgs / total orgs
  const freeOrgs = planBreakdown.find((p) => p.planTier === 'free')?._count.id ?? 0;
  const churnRate = totalOrgs > 0 ? Math.round(((totalOrgs - paidOrgs) / totalOrgs) * 100) : 0;

  // Trial conversion: paid / total
  const conversionRate = totalOrgs > 0 ? Math.round((paidOrgs / totalOrgs) * 100) : 0;

  const totalCreditsMonthly = creditUsage._sum.crawlCreditsMonthly ?? 0;
  const totalCreditsRemaining = creditUsage._sum.crawlCreditsRemaining ?? 0;
  const creditsUsed = totalCreditsMonthly - totalCreditsRemaining;

  return NextResponse.json({
    success: true,
    data: {
      mrr,
      arr,
      churnRate,
      conversionRate,
      paidOrgs,
      totalOrgs,
      planBreakdown: planBreakdown.map((p) => ({ name: p.planTier, count: p._count.id, revenue: (PLAN_PRICES[p.planTier] ?? 0) * p._count.id })),
      expiringOrgs,
      creditUsage: { totalMonthly: totalCreditsMonthly, remaining: totalCreditsRemaining, used: creditsUsed },
    },
  });
}
