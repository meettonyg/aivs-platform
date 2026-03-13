import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  if (body.action === 'cancel') {
    const job = await prisma.crawlJob.findUnique({ where: { id }, select: { status: true } });
    if (!job) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } }, { status: 404 });
    }
    if (job.status !== 'pending' && job.status !== 'running') {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Job is not cancellable' } }, { status: 400 });
    }

    const updated = await prisma.crawlJob.update({
      where: { id },
      data: { status: 'failed', completedAt: new Date() },
      select: { id: true, status: true },
    });

    return NextResponse.json({ success: true, data: updated });
  }

  return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid action' } }, { status: 400 });
}
