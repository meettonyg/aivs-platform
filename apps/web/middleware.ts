import { NextRequest, NextResponse } from 'next/server';

/**
 * Multi-tenant middleware — resolves white-label custom domains.
 *
 * If the request comes from a custom domain (not our platform domains),
 * we set headers so downstream pages can look up the org and apply branding.
 *
 * Note: We can't call Prisma in Edge middleware, so we pass the hostname
 * as a header and resolve it in server components / API routes.
 */

const PLATFORM_DOMAINS = new Set([
  'localhost',
  'localhost:3000',
  'aivs.app',
  'www.aivs.app',
  'app.aivs.app',
]);

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const baseDomain = hostname.split(':')[0];

  // If it's a platform domain, pass through
  if (PLATFORM_DOMAINS.has(hostname) || PLATFORM_DOMAINS.has(baseDomain)) {
    return NextResponse.next();
  }

  // Custom domain detected — set header for downstream resolution
  const response = NextResponse.next();
  response.headers.set('x-custom-domain', hostname);
  response.headers.set('x-tenant-hostname', baseDomain);

  // Rewrite client portal routes for custom domains
  const pathname = request.nextUrl.pathname;

  // Custom domains only have access to the client portal, not the full dashboard
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/portal')) {
    const url = request.nextUrl.clone();
    url.pathname = '/portal';
    return NextResponse.rewrite(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API internals
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};
