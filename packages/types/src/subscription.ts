export type PlanTier = 'free' | 'pro' | 'agency' | 'enterprise';

export interface Subscription {
  id: string;
  organizationId: string;
  tier: PlanTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  crawlCreditsMonthly: number;
  crawlCreditsRemaining: number;
  currentPeriodEnd: string | null;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
}

export const PLAN_LIMITS: Record<PlanTier, {
  crawlCreditsMonthly: number;
  maxDomains: number;
  maxTeamMembers: number;
  hasWhiteLabel: boolean;
  hasFullWhiteLabel: boolean;
  hasApi: boolean;
  hasDeepScan: boolean;
}> = {
  free: {
    crawlCreditsMonthly: 5,
    maxDomains: 0,
    maxTeamMembers: 1,
    hasWhiteLabel: false,
    hasFullWhiteLabel: false,
    hasApi: false,
    hasDeepScan: false,
  },
  pro: {
    crawlCreditsMonthly: 5_000,
    maxDomains: 10,
    maxTeamMembers: 3,
    hasWhiteLabel: true,
    hasFullWhiteLabel: false,
    hasApi: true,
    hasDeepScan: false,
  },
  agency: {
    crawlCreditsMonthly: 25_000,
    maxDomains: 50,
    maxTeamMembers: 10,
    hasWhiteLabel: true,
    hasFullWhiteLabel: true,
    hasApi: true,
    hasDeepScan: true,
  },
  enterprise: {
    crawlCreditsMonthly: 100_000,
    maxDomains: Infinity,
    maxTeamMembers: Infinity,
    hasWhiteLabel: true,
    hasFullWhiteLabel: true,
    hasApi: true,
    hasDeepScan: true,
  },
};
