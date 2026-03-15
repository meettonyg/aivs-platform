/**
 * YouTube Channel analyzer (org-level authority signal).
 *
 * Searches YouTube for channels matching the brand/domain.
 * Returns candidates for user attribution/disambiguation.
 * Score is 0 until the user confirms which channel is theirs.
 */

import {
  isYouTubeConfigured,
  searchChannels,
  type YouTubeChannelInfo,
} from './youtube-client';
import type { YouTubeChannelResult, YouTubeChannelCandidate, AttributionRecord } from './authority-cache';

export async function analyzeYouTubeChannel(domain: string): Promise<YouTubeChannelResult> {
  if (!isYouTubeConfigured()) {
    return { candidates: [], confirmed: [], score: 0 };
  }

  const brandName = extractBrandName(domain);
  if (!brandName || brandName.length < 2) {
    return { candidates: [], confirmed: [], score: 0 };
  }

  try {
    const channels = await searchChannels(brandName, 5);

    const candidates: YouTubeChannelCandidate[] = channels.map((ch) => ({
      id: `yt:${ch.channelId}`,
      channelId: ch.channelId,
      title: ch.title,
      description: ch.description,
      customUrl: ch.customUrl,
      subscriberCount: ch.subscriberCount,
      videoCount: ch.videoCount,
      viewCount: ch.viewCount,
      thumbnailUrl: ch.thumbnailUrl,
      publishedAt: ch.publishedAt,
    }));

    return {
      candidates,
      confirmed: [], // Populated after user attribution
      score: 0,      // Always 0 until confirmed
    };
  } catch {
    return { candidates: [], confirmed: [], score: 0 };
  }
}

/**
 * Compute YouTube channel authority score from confirmed attribution.
 * Called after the user confirms which channel is theirs.
 */
export function computeYouTubeAuthorityScore(
  confirmed: AttributionRecord[],
  candidates: YouTubeChannelCandidate[],
): number {
  const confirmedIds = new Set(
    confirmed.filter((a) => a.status === 'confirmed').map((a) => a.candidateId),
  );
  const confirmedChannels = candidates.filter((c) => confirmedIds.has(c.id));

  if (confirmedChannels.length === 0) return 0;

  // Use the best channel (highest subscribers)
  const best = confirmedChannels.reduce((a, b) =>
    (b.subscriberCount ?? 0) > (a.subscriberCount ?? 0) ? b : a,
  );

  let score = 0;

  // Channel found
  score += 20;

  // Subscriber tiers
  const subs = best.subscriberCount ?? 0;
  if (subs >= 1_000) score += 10;
  if (subs >= 10_000) score += 10;
  if (subs >= 100_000) score += 15;

  // Video count
  const videos = best.videoCount ?? 0;
  if (videos >= 50) score += 10;
  if (videos >= 200) score += 10;

  // Total views
  const views = best.viewCount ?? 0;
  if (views >= 100_000) score += 10;
  if (views >= 1_000_000) score += 15;

  return Math.min(100, score);
}

function extractBrandName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[.-]/g, ' ')
    .trim();
}
