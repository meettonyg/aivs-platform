import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * GET /api/projects/[id]/authority/people — List people for this project
 * POST /api/projects/[id]/authority/people — Add a person
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
      include: { organization: { include: { members: true } }, people: { orderBy: { createdAt: 'asc' } } },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: project.people });
  } catch (error) {
    console.error('People list error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to list people' } }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
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

    const body = await request.json() as { name?: string; role?: string };
    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Name is required (min 2 characters)' } }, { status: 400 });
    }

    const person = await prisma.projectPerson.upsert({
      where: { projectId_name: { projectId: id, name: body.name.trim() } },
      create: { projectId: id, name: body.name.trim(), role: body.role?.trim() || null },
      update: { role: body.role?.trim() || undefined },
    });

    return NextResponse.json({ success: true, data: person }, { status: 201 });
  } catch (error) {
    console.error('People create error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to add person' } }, { status: 500 });
  }
}
