/**
 * White-label utilities — resolve org from custom domain, load branding.
 */

import { prisma } from '@aivs/db';
import type { WhiteLabelConfig, BrandingConfig } from '@aivs/types';
import { DEFAULT_BRANDING } from '@aivs/types';

// In-memory cache for domain → org mapping (TTL: 5 min)
const domainCache = new Map<string, { orgId: string; settings: WhiteLabelConfig; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Resolve organization from a custom domain hostname.
 * Returns null if hostname is not a custom domain.
 */
export async function resolveOrgFromDomain(hostname: string): Promise<{
  orgId: string;
  settings: WhiteLabelConfig;
} | null> {
  // Skip known platform domains
  const platformDomains = [
    'localhost',
    'aivs.app',
    'www.aivs.app',
    'app.aivs.app',
  ];

  if (platformDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
    return null;
  }

  // Check cache
  const cached = domainCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return { orgId: cached.orgId, settings: cached.settings };
  }

  // Look up org with matching custom domain in settings
  const orgs = await prisma.organization.findMany({
    where: {
      settings: {
        path: ['customDomain', 'domain'],
        equals: hostname,
      },
    },
    select: { id: true, settings: true },
    take: 1,
  });

  if (orgs.length === 0) return null;

  const org = orgs[0];
  const settings = (org.settings ?? {}) as unknown as WhiteLabelConfig;

  // Verify domain is verified
  if (!settings.customDomain?.verified) return null;

  // Cache the result
  domainCache.set(hostname, {
    orgId: org.id,
    settings,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return { orgId: org.id, settings };
}

/**
 * Get branding config for an organization.
 */
export async function getOrgBranding(orgId: string): Promise<BrandingConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  if (!org) return DEFAULT_BRANDING;

  const settings = (org.settings ?? {}) as unknown as WhiteLabelConfig;
  return settings.branding ?? DEFAULT_BRANDING;
}

/**
 * Generate CSS custom properties from branding config.
 */
export function brandingToCssVars(branding: BrandingConfig): string {
  return `
    --brand-primary: ${branding.primaryColor};
    --brand-secondary: ${branding.secondaryColor};
    --brand-accent: ${branding.accentColor};
  `.trim();
}

/**
 * Clear domain cache (for testing or after settings update).
 */
export function clearDomainCache(hostname?: string) {
  if (hostname) {
    domainCache.delete(hostname);
  } else {
    domainCache.clear();
  }
}
