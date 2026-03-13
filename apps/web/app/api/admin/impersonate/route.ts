import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@aivs/db';
import { auth } from '@/lib/auth';
import { encode, decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';

const SESSION_COOKIE = process.env.NODE_ENV === 'production'
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'superadmin') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, { status: 403 });
  }

  const body = await req.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'userId is required' } }, { status: 400 });
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!targetUser) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
  }

  // Update the JWT with impersonation data
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No session token' } }, { status: 400 });
  }

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? '';
  const token = await decode({ token: sessionToken, secret, salt: SESSION_COOKIE });

  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid session token' } }, { status: 400 });
  }

  // Set impersonation
  token.impersonatingUserId = userId;

  const newToken = await encode({ token, secret, salt: SESSION_COOKIE });

  const response = NextResponse.json({ success: true, data: { impersonating: targetUser } });
  response.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No session token' } }, { status: 400 });
  }

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? '';
  const token = await decode({ token: sessionToken, secret, salt: SESSION_COOKIE });

  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid session' } }, { status: 400 });
  }

  // Remove impersonation
  delete token.impersonatingUserId;
  delete token.impersonatedUser;

  const newToken = await encode({ token, secret, salt: SESSION_COOKIE });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
