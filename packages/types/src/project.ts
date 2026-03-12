export interface Project {
  id: string;
  organizationId: string;
  domain: string;
  name: string;
  latestScore: number | null;
  latestTier: string | null;
  lastScannedAt: string | null;
  createdAt: string;
}
