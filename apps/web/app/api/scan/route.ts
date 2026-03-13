import { NextRequest, NextResponse } from 'next/server';
import { scanUrl } from '@aivs/scanner-engine';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

function buildCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const headers = buildCorsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, projectId, pageType } = body;

    if (!url || typeof url !== 'string') {
      return withCors(request, NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'URL is required' } },
        { status: 400 },
      ));
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return withCors(request, NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Invalid URL format' } },
        { status: 400 },
      ));
    }

    // Check auth for project-linked scans
    const session = await auth();
    let orgId: string | null = null;

    if (projectId) {
      if (!session?.user) {
        return withCors(request, NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        ));
      }

      const userId = (session.user as { id?: string }).id;
      if (!userId) {
        return withCors(request, NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
          { status: 401 },
        ));
      }

      // Verify project access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { organization: { include: { members: true } } },
      });

      if (!project || !project.organization.members.some((m) => m.userId === userId)) {
        return withCors(request, NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 },
        ));
      }

      orgId = project.organizationId;

      // Check credits
      if (project.organization.crawlCreditsRemaining <= 0) {
        return withCors(request, NextResponse.json(
          { success: false, error: { code: 'CREDITS_EXHAUSTED', message: 'No crawl credits remaining' } },
          { status: 402 },
        ));
      }
    }

    // Run scan
    const result = await scanUrl(url, { pageType });

    // Save to database
    const scan = await prisma.scan.create({
      data: {
        projectId: projectId ?? null,
        url: result.url,
        hash: result.hash,
        score: result.score,
        tier: result.tier,
        subScores: result.subScores as object,
        layerScores: result.layerScores as object,
        extraction: result.extraction as object,
        fixes: result.fixes as object[],
        citationSimulation: result.citationSimulation as object,
        robotsData: result.robotsData as object,
        pageType: result.pageType,
      },
    });

    // Decrement credits if authenticated scan
    if (orgId) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { crawlCreditsRemaining: { decrement: 1 } },
      });
    }

    return withCors(request, NextResponse.json({ success: true, data: { ...result, id: scan.id } }));
  } catch (error) {
    console.error('Scan error:', error);
    const message = error instanceof Error ? error.message : 'Scan failed';
    return withCors(request, NextResponse.json(
      { success: false, error: { code: 'SCAN_FAILED', message } },
      { status: 500 },
    ));
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return withCors(request, NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'URL parameter required' } },
      { status: 400 },
    ));
  }

  try {
    const result = await scanUrl(url);

    // Save to database
    const scan = await prisma.scan.create({
      data: {
        projectId: null,
        url: result.url,
        hash: result.hash,
        score: result.score,
        tier: result.tier,
        subScores: result.subScores as object,
        layerScores: result.layerScores as object,
        extraction: result.extraction as object,
        fixes: result.fixes as object[],
        citationSimulation: result.citationSimulation as object,
        robotsData: result.robotsData as object,
        pageType: result.pageType,
      },
    });

    return withCors(request, NextResponse.json({ success: true, data: { ...result, id: scan.id } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    return withCors(request, NextResponse.json(
      { success: false, error: { code: 'SCAN_FAILED', message } },
      { status: 500 },
    ));
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}
