import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

async function getUserOrg(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: { userId },
    include: { organization: true },
  });
  return membership?.organization ?? null;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const org = await getUserOrg(userId);
  if (!org) {
    return NextResponse.json({ success: true, data: [] });
  }

  const projects = await prisma.project.findMany({
    where: { organizationId: org.id },
    include: {
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { score: true, tier: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const data = projects.map((p) => ({
    id: p.id,
    domain: p.domain,
    name: p.name,
    latestScore: p.scans[0]?.score ?? null,
    latestTier: p.scans[0]?.tier ?? null,
    lastScannedAt: p.scans[0]?.createdAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  const org = await getUserOrg(userId);
  if (!org) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_ORG', message: 'No organization found' } },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { domain, name } = body;

  if (!domain || !name) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Domain and name are required' } },
      { status: 400 },
    );
  }

  // Check domain limit
  const projectCount = await prisma.project.count({
    where: { organizationId: org.id },
  });

  const { PLAN_LIMITS } = await import('@aivs/types');
  const tier = org.planTier as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[tier]?.maxDomains ?? 0;

  if (limit > 0 && projectCount >= limit) {
    return NextResponse.json(
      { success: false, error: { code: 'LIMIT_REACHED', message: `Your plan allows a maximum of ${limit} domains` } },
      { status: 403 },
    );
  }

  try {
    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        domain: domain.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
        name,
      },
    });

    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This domain already exists in your organization' } },
        { status: 409 },
      );
    }
    throw error;
  }
}
