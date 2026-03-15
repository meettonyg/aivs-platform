import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/projects/[id]/authority/attributions — List attributions
 * PUT /api/projects/[id]/authority/attributions — Confirm or reject a candidate
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: { include: { members: true } } },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    const attributions = await prisma.attribution.findMany({
      where: { projectId: id },
      orderBy: { attributedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: attributions });
  } catch (error) {
    console.error('Attributions list error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to list attributions' } }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id!;
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: { include: { members: true } } },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    const body = await request.json() as {
      candidateId?: string;
      type?: string;
      status?: string;
      title?: string;
      subtitle?: string;
      personName?: string;
    };

    if (!body.candidateId || !body.type || !body.status || !body.title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'candidateId, type, status, and title are required' } },
        { status: 400 },
      );
    }

    if (!['confirmed', 'rejected'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'status must be "confirmed" or "rejected"' } },
        { status: 400 },
      );
    }

    const attribution = await prisma.attribution.upsert({
      where: { projectId_candidateId: { projectId: id, candidateId: body.candidateId } },
      create: {
        projectId: id,
        domain: project.domain,
        personName: body.personName?.trim() || null,
        candidateId: body.candidateId,
        type: body.type,
        status: body.status,
        title: body.title,
        subtitle: body.subtitle || null,
        attributedBy: userId,
      },
      update: {
        status: body.status,
        attributedBy: userId,
        attributedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: attribution });
  } catch (error) {
    console.error('Attribution upsert error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to save attribution' } }, { status: 500 });
  }
}
