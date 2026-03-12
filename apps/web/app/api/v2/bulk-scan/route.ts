import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { getScanQueue } from '@/lib/queue';
import { createHash } from 'crypto';

/**
 * POST /api/v2/bulk-scan — Bulk scan up to 1,000 URLs
 *
 * Authenticated via API key (X-API-Key header).
 * Enterprise tier only.
 *
 * Body: { urls: string[], projectId?: string, options?: { pageType?: string } }
 * Returns: { jobIds: string[], queued: number }
 */
export async function POST(request: NextRequest) {
  try {
    // API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'X-API-Key header required' } },
        { status: 401 },
      );
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { organization: true },
    });

    if (!key) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
        { status: 401 },
      );
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    // Check plan — bulk API requires Enterprise
    if (key.organization.planTier !== 'enterprise' && key.organization.planTier !== 'agency') {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Agency or Enterprise plan required for bulk API' } },
        { status: 403 },
      );
    }

    // Check scope
    if (!key.scopes.includes('scan:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'API key missing scan:write scope' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { urls, projectId, options } = body;

    // Validate project ownership (defense against cross-tenant projectId injection)
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: String(projectId),
          organizationId: key.organizationId,
        },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'projectId is not accessible by this API key' } },
          { status: 403 },
        );
      }
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'urls array is required (1-1000 URLs)' } },
        { status: 400 },
      );
    }

    const maxUrls = key.organization.planTier === 'enterprise' ? 1000 : 100;
    if (urls.length > maxUrls) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: `Maximum ${maxUrls} URLs per request` } },
        { status: 400 },
      );
    }

    // Check credits
    if (key.organization.crawlCreditsRemaining < urls.length) {
      return NextResponse.json(
        { success: false, error: { code: 'CREDITS_EXHAUSTED', message: `Insufficient credits: ${key.organization.crawlCreditsRemaining} remaining, ${urls.length} requested` } },
        { status: 402 },
      );
    }

    // Validate URLs
    const validUrls: string[] = [];
    const invalid: string[] = [];

    for (const url of urls) {
      try {
        const parsed = new URL(String(url));
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          validUrls.push(parsed.toString());
        } else {
          invalid.push(String(url));
        }
      } catch {
        invalid.push(String(url));
      }
    }

    // Enqueue all valid URLs
    const jobIds: string[] = [];
    for (const url of validUrls) {
      const job = await getScanQueue().add('scan', {
        url,
        projectId: projectId ?? null,
        organizationId: key.organizationId,
        options: options ?? {},
      });
      jobIds.push(job.id!);
    }

    return NextResponse.json({
      success: true,
      data: {
        queued: validUrls.length,
        invalid: invalid.length,
        jobIds,
        invalidUrls: invalid.length > 0 ? invalid : undefined,
      },
    });
  } catch (error) {
    console.error('Bulk scan error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Bulk scan failed' } },
      { status: 500 },
    );
  }
}
