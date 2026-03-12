import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import type { WhiteLabelConfig } from '@aivs/types';


type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * GET /api/integrations — Get configured integrations
 * PUT /api/integrations — Update integration config
 *
 * Stores integration config in organization.settings.integrations
 */

interface IntegrationsConfig {
  [key: string]: JsonValue | undefined;
  slack?: {
    webhookUrl: string;
    channel?: string;
    enabled: boolean;
    events: string[];
  };
  teams?: {
    webhookUrl: string;
    enabled: boolean;
    events: string[];
  };
  wordpress?: {
    siteUrl: string;
    apiKey: string;
    enabled: boolean;
  };
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId! },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'No organization found' } }, { status: 404 });
    }

    const settings = (membership.organization.settings ?? {}) as Record<string, unknown>;
    const integrations = (settings.integrations ?? {}) as IntegrationsConfig;

    // Redact webhook URLs for security
    return NextResponse.json({
      success: true,
      data: {
        slack: integrations.slack ? {
          configured: true,
          enabled: integrations.slack.enabled,
          channel: integrations.slack.channel,
          events: integrations.slack.events,
          webhookUrl: integrations.slack.webhookUrl ? '***configured***' : null,
        } : { configured: false },
        teams: integrations.teams ? {
          configured: true,
          enabled: integrations.teams.enabled,
          events: integrations.teams.events,
          webhookUrl: integrations.teams.webhookUrl ? '***configured***' : null,
        } : { configured: false },
        wordpress: integrations.wordpress ? {
          configured: true,
          enabled: integrations.wordpress.enabled,
          siteUrl: integrations.wordpress.siteUrl,
        } : { configured: false },
      },
    });
  } catch (error) {
    console.error('Integrations GET error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to get integrations' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const membership = await prisma.orgMember.findFirst({
      where: { userId: userId!, role: { in: ['owner', 'admin'] } },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
    }

    const tier = membership.organization.planTier;
    if (tier === 'free') {
      return NextResponse.json({ success: false, error: { code: 'PLAN_REQUIRED', message: 'Pro plan or above required for integrations' } }, { status: 403 });
    }

    const body = await request.json();
    const settings = (membership.organization.settings ?? {}) as Record<string, unknown>;
    const currentIntegrations = (settings.integrations ?? {}) as IntegrationsConfig;

    // Update only provided integrations
    const updatedIntegrations: IntegrationsConfig = { ...currentIntegrations };

    if (body.slack !== undefined) {
      if (body.slack === null) {
        delete updatedIntegrations.slack;
      } else {
        updatedIntegrations.slack = {
          ...(currentIntegrations.slack ?? { webhookUrl: '', enabled: false, events: [] }),
          ...body.slack,
        };
      }
    }

    if (body.teams !== undefined) {
      if (body.teams === null) {
        delete updatedIntegrations.teams;
      } else {
        updatedIntegrations.teams = {
          ...(currentIntegrations.teams ?? { webhookUrl: '', enabled: false, events: [] }),
          ...body.teams,
        };
      }
    }

    if (body.wordpress !== undefined) {
      if (body.wordpress === null) {
        delete updatedIntegrations.wordpress;
      } else {
        updatedIntegrations.wordpress = {
          ...(currentIntegrations.wordpress ?? { siteUrl: '', apiKey: '', enabled: false }),
          ...body.wordpress,
        };
      }
    }

    await prisma.organization.update({
      where: { id: membership.organizationId },
      data: {
        settings: { ...settings, integrations: updatedIntegrations },
      },
    });

    return NextResponse.json({ success: true, data: { updated: true } });
  } catch (error) {
    console.error('Integrations PUT error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Failed to update integrations' } }, { status: 500 });
  }
}
