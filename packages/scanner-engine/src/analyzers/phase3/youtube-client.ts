/**
 * YouTube Data API v3 client.
 *
 * Free tier: 10,000 quota units/day.
 * search.list = 100 units, channels.list = 1 unit.
 * The 30-day authority cache keeps usage well within limits.
 */

import { request } from 'undici';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

export function isYouTubeConfigured(): boolean {
  return !!YOUTUBE_API_KEY;
}

/**
 * Search for YouTube channels matching a query (brand name).
 * Costs 100 quota units per call.
 */
export async function searchChannels(query: string, maxResults = 5): Promise<YouTubeChannelInfo[]> {
  if (!YOUTUBE_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'channel',
      maxResults: String(Math.min(maxResults, 10)),
      key: YOUTUBE_API_KEY,
    });

    const res = await request(`${YOUTUBE_API_BASE}/search?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      items?: {
        id: { channelId: string };
        snippet: {
          channelTitle: string;
          description: string;
          thumbnails?: { default?: { url: string } };
          publishedAt: string;
        };
      }[];
    };

    const channelIds = (data.items ?? []).map((item) => item.id.channelId);
    if (channelIds.length === 0) return [];

    // Fetch full stats (only 1 quota unit per channel)
    return getChannelsByIds(channelIds);
  } catch {
    return [];
  }
}

/**
 * Fetch channel details by IDs. Costs 1 quota unit.
 */
export async function getChannelsByIds(channelIds: string[]): Promise<YouTubeChannelInfo[]> {
  if (!YOUTUBE_API_KEY || channelIds.length === 0) return [];

  try {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: channelIds.join(','),
      key: YOUTUBE_API_KEY,
    });

    const res = await request(`${YOUTUBE_API_BASE}/channels?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.statusCode !== 200) {
      await res.body.dump();
      return [];
    }

    const data = await res.body.json() as {
      items?: {
        id: string;
        snippet: {
          title: string;
          description: string;
          customUrl?: string;
          thumbnails?: { default?: { url: string } };
          publishedAt: string;
        };
        statistics: {
          subscriberCount?: string;
          videoCount?: string;
          viewCount?: string;
          hiddenSubscriberCount?: boolean;
        };
      }[];
    };

    return (data.items ?? []).map((item) => ({
      channelId: item.id,
      title: item.snippet.title,
      description: item.snippet.description || null,
      customUrl: item.snippet.customUrl ?? null,
      subscriberCount: item.statistics.hiddenSubscriberCount
        ? null
        : parseInt(item.statistics.subscriberCount ?? '0', 10) || null,
      videoCount: parseInt(item.statistics.videoCount ?? '0', 10) || null,
      viewCount: parseInt(item.statistics.viewCount ?? '0', 10) || null,
      thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
      publishedAt: item.snippet.publishedAt ?? null,
    }));
  } catch {
    return [];
  }
}
