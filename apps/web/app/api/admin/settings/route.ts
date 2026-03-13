import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { requireSuperAdminApi } from '@/lib/admin';

export async function GET() {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  let settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: 'singleton' },
    });
  }

  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(req: NextRequest) {
  const { error } = await requireSuperAdminApi();
  if (error) return error;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.defaultCrawlCredits === 'number') {
    updates.defaultCrawlCredits = body.defaultCrawlCredits;
  }
  if (typeof body.defaultRateLimit === 'number') {
    updates.defaultRateLimit = body.defaultRateLimit;
  }
  if (typeof body.featureFlags === 'object' && body.featureFlags !== null) {
    updates.featureFlags = body.featureFlags;
  }
  if (typeof body.maintenanceMode === 'boolean') {
    updates.maintenanceMode = body.maintenanceMode;
  }
  if (typeof body.systemEmailFrom === 'string' || body.systemEmailFrom === null) {
    updates.systemEmailFrom = body.systemEmailFrom;
  }
  if (typeof body.systemEmailReplyTo === 'string' || body.systemEmailReplyTo === null) {
    updates.systemEmailReplyTo = body.systemEmailReplyTo;
  }

  const settings = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...updates },
    update: updates,
  });

  return NextResponse.json({ success: true, data: settings });
}
