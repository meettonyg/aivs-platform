import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * POST /api/agency/clients — Create a client sub-organization
 * Body: { name, slug? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
        { status: 401 },
      );
    }

    const membership = await prisma.orgMember.findFirst({
      where: { userId, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const org = membership.organization;
    if (org.planTier !== 'agency' && org.planTier !== 'enterprise') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Agency or Enterprise plan required' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'name is required (min 2 chars)' } },
        { status: 400 },
      );
    }

    const slug = body.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check slug uniqueness
    const existingSlug = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Organization slug already exists' } },
        { status: 409 },
      );
    }

    const clientOrg = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        planTier: 'free', // Inherits from parent plan features
        parentOrgId: org.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: clientOrg.id,
        name: clientOrg.name,
        slug: clientOrg.slug,
        parentOrgId: clientOrg.parentOrgId,
      },
    });
  } catch (error) {
    console.error('Client create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to create client' } },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agency/clients — List client sub-organizations
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
        { status: 401 },
      );
    }

    const membership = await prisma.orgMember.findFirst({
      where: { userId, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const clients = await prisma.organization.findMany({
      where: { parentOrgId: membership.organizationId },
      include: {
        _count: { select: { projects: true, members: true } },
        projects: {
          select: { id: true, domain: true, siteScore: true, siteTier: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: clients.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        projectCount: c._count.projects,
        memberCount: c._count.members,
        projects: c.projects,
      })),
    });
  } catch (error) {
    console.error('Client list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to list clients' } },
      { status: 500 },
    );
  }
}
