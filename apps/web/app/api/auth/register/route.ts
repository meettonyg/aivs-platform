import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, orgName } = body;

    if (!name || !email || !password || !orgName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'All fields are required' } },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Password must be at least 8 characters' } },
        { status: 400 },
      );
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'An account with this email already exists' } },
        { status: 409 },
      );
    }

    // Create user + organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
        },
      });

      let slug = slugify(orgName);
      const existingOrg = await tx.organization.findUnique({ where: { slug } });
      if (existingOrg) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          planTier: 'free',
          crawlCreditsMonthly: 5,
          crawlCreditsRemaining: 5,
        },
      });

      await tx.orgMember.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'owner',
        },
      });

      return { user, org };
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.id,
        organizationId: result.org.id,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
