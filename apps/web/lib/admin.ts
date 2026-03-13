import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Server component / server action guard.
 * Redirects non-superadmins to /dashboard.
 */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');
  const role = (session.user as { role?: string }).role;
  if (role !== 'superadmin') redirect('/dashboard');
  return session;
}

/**
 * API route guard.
 * Returns a 403 response if the user is not a superadmin.
 */
export async function requireSuperAdminApi() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 }) };
  }
  const role = (session.user as { role?: string }).role;
  if (role !== 'superadmin') {
    return { session: null, error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Superadmin access required' } }, { status: 403 }) };
  }
  return { session, error: null };
}
