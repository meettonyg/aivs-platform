import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true, planTier: true },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.role && ['user', 'admin', 'superadmin'].includes(body.role)) {
    updates.role = body.role;
  }

  if (typeof body.name === 'string') {
    updates.name = body.name;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updates,
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ success: true, data: user });
}
