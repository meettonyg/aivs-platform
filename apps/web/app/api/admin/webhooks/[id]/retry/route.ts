import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const webhook = await prisma.webhook.findUnique({ where: { id } });

  if (!webhook) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, { status: 404 });
  }

  // Reset failure count and reactivate
  const updated = await prisma.webhook.update({
    where: { id },
    data: { failureCount: 0, active: true },
    select: { id: true, url: true, active: true, failureCount: true },
  });

  return NextResponse.json({ success: true, data: updated });
}
