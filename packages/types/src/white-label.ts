/**
 * White-label configuration types.
 *
 * Basic white-label (Pro): logo, colors, branded PDFs
 * Full white-label (Agency): custom domains, client portal, embed widget, email templates
 */

export interface WhiteLabelConfig {
  /** Basic branding (Pro+) */
  branding?: BrandingConfig;
  /** Custom domain (Agency+) */
  customDomain?: CustomDomainConfig;
  /** Client portal settings (Agency+) */
  clientPortal?: ClientPortalConfig;
  /** Email customization (Pro+) */
  email?: EmailConfig;
  /** PDF report customization (Pro+) */
  pdf?: PdfConfig;
  /** Embeddable widget config (Agency+) */
  embedWidget?: EmbedWidgetConfig;
}

export interface BrandingConfig {
  /** Logo URL (uploaded to storage) */
  logoUrl?: string;
  /** Favicon URL */
  faviconUrl?: string;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary brand color (hex) */
  secondaryColor: string;
  /** Accent color (hex) */
  accentColor: string;
  /** Custom company name displayed in UI */
  companyName?: string;
  /** Tagline shown on login/portal pages */
  tagline?: string;
  /** Hide "Powered by AI Visibility Scanner" */
  hidePoweredBy: boolean;
}

export interface CustomDomainConfig {
  /** Custom domain (e.g., scanner.theiragency.com) */
  domain: string;
  /** Whether domain DNS is verified */
  verified: boolean;
  /** SSL certificate status */
  sslStatus: 'pending' | 'active' | 'failed';
  /** Last DNS check */
  lastCheckedAt?: string;
}

export interface ClientPortalConfig {
  /** Enable standalone client portal */
  enabled: boolean;
  /** Welcome message shown on portal login */
  welcomeMessage?: string;
  /** Features visible to clients */
  visibleFeatures: {
    scores: boolean;
    fixes: boolean;
    trends: boolean;
    citationSim: boolean;
    exports: boolean;
  };
}

export interface EmailConfig {
  /** Custom sender name */
  senderName?: string;
  /** Custom reply-to address */
  replyTo?: string;
  /** Email footer text */
  footerText?: string;
}

export interface PdfConfig {
  /** Custom cover page background image URL */
  coverImageUrl?: string;
  /** Header logo URL (defaults to branding.logoUrl) */
  headerLogoUrl?: string;
  /** Footer text */
  footerText?: string;
  /** Agency contact details shown on PDF */
  contactInfo?: string;
  /** Font family */
  fontFamily?: 'inter' | 'roboto' | 'open-sans' | 'lato';
}

export interface EmbedWidgetConfig {
  /** Allowed origin domains for embed */
  allowedOrigins: string[];
  /** Widget theme */
  theme: 'light' | 'dark' | 'auto';
  /** Show full results or just score */
  displayMode: 'full' | 'score-only' | 'score-and-tier';
  /** Custom CTA text */
  ctaText?: string;
  /** CTA link URL */
  ctaUrl?: string;
}

/**
 * Default branding config for new orgs.
 */
export const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
  hidePoweredBy: false,
};
