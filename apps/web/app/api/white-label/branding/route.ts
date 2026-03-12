import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { PLAN_LIMITS } from '@aivs/types';
import type { WhiteLabelConfig, BrandingConfig } from '@aivs/types';
import { clearDomainCache } from '@/lib/white-label';

/**
 * GET /api/white-label/branding — Get current branding config
 * PUT /api/white-label/branding — Update branding config (Pro+)
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId! },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No organization found' } },
        { status: 404 },
      );
    }

    const settings = (membership.organization.settings ?? {}) as unknown as WhiteLabelConfig;

    return NextResponse.json({
      success: true,
      data: {
        branding: settings.branding ?? null,
        customDomain: settings.customDomain ?? null,
        email: settings.email ?? null,
        pdf: settings.pdf ?? null,
        embedWidget: settings.embedWidget ?? null,
        clientPortal: settings.clientPortal ?? null,
      },
    });
  } catch (error) {
    console.error('Branding GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to get branding' } },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId!, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const org = membership.organization;
    const planLimits = PLAN_LIMITS[org.planTier as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

    if (!planLimits.hasWhiteLabel) {
      return NextResponse.json(
        { success: false, error: { code: 'PLAN_REQUIRED', message: 'Pro plan or above required for white-label' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const currentSettings = (org.settings ?? {}) as unknown as WhiteLabelConfig;

    // Validate branding fields
    const updatedSettings: WhiteLabelConfig = { ...currentSettings };

    if (body.branding) {
      const b = body.branding as Partial<BrandingConfig>;
      updatedSettings.branding = {
        ...(currentSettings.branding ?? {}),
        primaryColor: b.primaryColor ?? currentSettings.branding?.primaryColor ?? '#2563eb',
        secondaryColor: b.secondaryColor ?? currentSettings.branding?.secondaryColor ?? '#1e40af',
        accentColor: b.accentColor ?? currentSettings.branding?.accentColor ?? '#3b82f6',
        hidePoweredBy: b.hidePoweredBy ?? currentSettings.branding?.hidePoweredBy ?? false,
        logoUrl: b.logoUrl ?? currentSettings.branding?.logoUrl,
        faviconUrl: b.faviconUrl ?? currentSettings.branding?.faviconUrl,
        companyName: b.companyName ?? currentSettings.branding?.companyName,
        tagline: b.tagline ?? currentSettings.branding?.tagline,
      };
    }

    if (body.email) {
      updatedSettings.email = {
        ...(currentSettings.email ?? {}),
        ...body.email,
      };
    }

    if (body.pdf) {
      updatedSettings.pdf = {
        ...(currentSettings.pdf ?? {}),
        ...body.pdf,
      };
    }

    // Full white-label features (Agency+)
    if (body.customDomain && planLimits.hasFullWhiteLabel) {
      updatedSettings.customDomain = {
        ...(currentSettings.customDomain ?? { domain: '', verified: false, sslStatus: 'pending' as const }),
        ...body.customDomain,
      };
    }

    if (body.clientPortal && planLimits.hasFullWhiteLabel) {
      updatedSettings.clientPortal = {
        ...(currentSettings.clientPortal ?? { enabled: false, visibleFeatures: { scores: true, fixes: true, trends: true, citationSim: true, exports: true } }),
        ...body.clientPortal,
      };
    }

    if (body.embedWidget && planLimits.hasFullWhiteLabel) {
      updatedSettings.embedWidget = {
        ...(currentSettings.embedWidget ?? { allowedOrigins: [], theme: 'auto' as const, displayMode: 'score-and-tier' as const }),
        ...body.embedWidget,
      };
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: { settings: updatedSettings as object },
    });

    // Clear domain cache if custom domain changed
    if (body.customDomain) {
      clearDomainCache();
    }

    return NextResponse.json({
      success: true,
      data: updatedSettings,
    });
  } catch (error) {
    console.error('Branding PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to update branding' } },
      { status: 500 },
    );
  }
}
