import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
