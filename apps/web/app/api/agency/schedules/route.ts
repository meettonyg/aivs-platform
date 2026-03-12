import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { scheduledScanQueue } from '@/lib/queue';

/**
 * POST /api/agency/schedules — Set scan schedule for a project
 * Body: { projectId, frequency: "daily" | "weekly" | "monthly" | null }
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

    const body = await request.json();
    const { projectId, frequency } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'projectId is required' } },
        { status: 400 },
      );
    }

    const validFreqs = ['daily', 'weekly', 'monthly', null];
    if (!validFreqs.includes(frequency)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'frequency must be daily, weekly, monthly, or null' } },
        { status: 400 },
      );
    }

    // Verify access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: { include: { members: true } } },
    });

    if (!project || !project.organization.members.some((m) => m.userId === userId)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    // Only Pro+ can schedule scans
    const tier = project.organization.planTier;
    if (tier === 'free') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Pro plan or above required for scheduled scans' } },
        { status: 403 },
      );
    }

    // Update schedule
    await prisma.project.update({
      where: { id: projectId },
      data: { scheduleFreq: frequency },
    });

    return NextResponse.json({
      success: true,
      data: { projectId, frequency },
    });
  } catch (error) {
    console.error('Schedule error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to update schedule' } },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agency/schedules — Trigger scheduled scans (called by cron)
 * Protected by API key in X-Cron-Secret header.
 */
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find projects due for scanning
    const projects = await prisma.project.findMany({
      where: {
        scheduleFreq: { not: null },
        OR: [
          { lastScheduledAt: null },
          {
            // Daily: last scan > 24h ago
            AND: [
              { scheduleFreq: 'daily' },
              { lastScheduledAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
            ],
          },
          {
            // Weekly: last scan > 7d ago
            AND: [
              { scheduleFreq: 'weekly' },
              { lastScheduledAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
            ],
          },
          {
            // Monthly: last scan > 30d ago
            AND: [
              { scheduleFreq: 'monthly' },
              { lastScheduledAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
            ],
          },
        ],
      },
      include: { organization: { select: { id: true, crawlCreditsRemaining: true } } },
    });

    let enqueued = 0;
    for (const project of projects) {
      if (project.organization.crawlCreditsRemaining <= 0) continue;

      await scheduledScanQueue.add('scheduled-scan', {
        projectId: project.id,
        organizationId: project.organizationId,
      });
      enqueued++;
    }

    return NextResponse.json({
      success: true,
      data: { checked: projects.length, enqueued },
    });
  } catch (error) {
    console.error('Cron trigger error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Cron trigger failed' } },
      { status: 500 },
    );
  }
}
