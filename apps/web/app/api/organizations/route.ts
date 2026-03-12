import { NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: { select: { projects: true, members: true } },
        },
      },
    },
  });

  const data = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    planTier: m.organization.planTier,
    role: m.role,
    crawlCreditsRemaining: m.organization.crawlCreditsRemaining,
    crawlCreditsMonthly: m.organization.crawlCreditsMonthly,
    projectCount: m.organization._count.projects,
    memberCount: m.organization._count.members,
  }));

  return NextResponse.json({ success: true, data });
}
