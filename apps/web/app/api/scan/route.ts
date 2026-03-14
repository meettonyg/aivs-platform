import { NextRequest, NextResponse } from 'next/server';
import { scanUrl } from '@aivs/scanner-engine';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';

/**
 * Convert raw scanner errors into user-friendly messages.
 */
function humanizeError(raw: string, url: string): string {
  const httpMatch = raw.match(/^HTTP (\d{3}) fetching /);
  if (httpMatch) {
    const code = Number(httpMatch[1]);
    if (code === 403) return `This site blocked our scanner. It may use a firewall that prevents automated access.`;
    if (code === 502 || code === 503 || code === 504)
      return `The site (${url}) is temporarily unavailable (HTTP ${code}). Please try again in a few minutes.`;
    if (code >= 400 && code < 500)
      return `Could not access this page (HTTP ${code}). Please check the URL and try again.`;
    if (code >= 500)
      return `The site returned a server error (HTTP ${code}). Please try again later.`;
  }
  if (raw.includes('other side closed') || raw.includes('ECONNRESET'))
    return `The site (${url}) closed the connection unexpectedly. This usually means a firewall or bot-protection system blocked the request. Please try again.`;
  if (raw.includes('fetch failed') || raw.includes('ENOTFOUND') || raw.includes('ECONNREFUSED'))
    return `Could not connect to ${url}. Please check the domain name and try again.`;
  if (raw.includes('timed out') || raw.includes('TimeoutError'))
    return `The request to ${url} timed out. The site may be slow or unavailable.`;
  if (raw.includes('Non-HTML content type'))
    return `This URL does not return an HTML page. Please enter a web page URL.`;
  return raw;
}

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
  let inputUrl = '';
  try {
    const body = await request.json();
    const { url: rawUrl, projectId, pageType } = body;
    inputUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';

    if (!rawUrl || typeof rawUrl !== 'string') {
      return withCors(request, NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'URL is required' } },
        { status: 400 },
      ));
    }

    // Auto-prepend https:// if no protocol provided
    const url = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;

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
    const raw = error instanceof Error ? error.message : 'Scan failed';
    const message = humanizeError(raw, inputUrl);
    return withCors(request, NextResponse.json(
      { success: false, error: { code: 'SCAN_FAILED', message } },
      { status: 500 },
    ));
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return withCors(request, NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'URL parameter required' } },
      { status: 400 },
    ));
  }

  // Auto-prepend https:// if no protocol provided
  const url = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;

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
    const raw = error instanceof Error ? error.message : 'Scan failed';
    const message = humanizeError(raw, rawUrl);
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
