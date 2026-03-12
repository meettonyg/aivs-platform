import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { crawlQueue } from '@/lib/queue';

/**
 * POST /api/crawl — Start a new site crawl
 * Body: { projectId, maxPages?, isIncremental? }
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
    const { projectId, maxPages, isIncremental } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'projectId is required' } },
        { status: 400 },
      );
    }

    // Verify project access
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

    // Check credits
    if (project.organization.crawlCreditsRemaining <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CREDITS_EXHAUSTED', message: 'No crawl credits remaining' } },
        { status: 402 },
      );
    }

    // Check for existing running crawl
    const runningCrawl = await prisma.crawlJob.findFirst({
      where: { projectId, status: 'running' },
    });

    if (runningCrawl) {
      return NextResponse.json(
        { success: false, error: { code: 'CRAWL_IN_PROGRESS', message: 'A crawl is already running for this project' } },
        { status: 409 },
      );
    }

    // Enqueue crawl job
    const job = await crawlQueue.add('crawl', {
      projectId,
      organizationId: project.organizationId,
      maxPages: maxPages ?? 100,
      isIncremental: !!isIncremental,
    });

    return NextResponse.json({
      success: true,
      data: { jobId: job.id, projectId, maxPages: maxPages ?? 100, isIncremental: !!isIncremental },
    });
  } catch (error) {
    console.error('Crawl start error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to start crawl' } },
      { status: 500 },
    );
  }
}

/**
 * GET /api/crawl — List crawl jobs for a project
 * Query: ?projectId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'projectId is required' } },
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

    const crawlJobs = await prisma.crawlJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ success: true, data: crawlJobs });
  } catch (error) {
    console.error('Crawl list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to list crawls' } },
      { status: 500 },
    );
  }
}
