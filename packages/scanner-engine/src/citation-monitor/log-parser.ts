/**
 * AI crawler log parser (Factors 9.1, 9.2, 9.8).
 *
 * Parses server access logs to identify visits from AI bots:
 * GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, etc.
 *
 * Supports Apache Combined and nginx log formats.
 */

export interface CrawlerVisit {
  timestamp: Date;
  bot: string;
  url: string;
  statusCode: number;
  userAgent: string;
  ip: string;
}

export interface CrawlerLogReport {
  totalVisits: number;
  uniquePages: number;
  botBreakdown: Record<string, { visits: number; uniquePages: number; lastSeen: string }>;
  topPages: { url: string; visits: number; bots: string[] }[];
  dailyTrend: { date: string; visits: number }[];
  newBots: string[];
}

const AI_BOT_PATTERNS: Record<string, RegExp> = {
  GPTBot: /GPTBot/i,
  ClaudeBot: /ClaudeBot|anthropic/i,
  PerplexityBot: /PerplexityBot/i,
  'Google-Extended': /Google-Extended/i,
  Googlebot: /Googlebot(?!-)/i,
  Bingbot: /bingbot/i,
  'ChatGPT-User': /ChatGPT-User/i,
  'Bytespider': /Bytespider/i,
  'CCBot': /CCBot/i,
  'Applebot': /Applebot/i,
  'Meta-ExternalAgent': /Meta-ExternalAgent/i,
};

// Apache Combined Log Format:
// 127.0.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://..." "Mozilla/..."
const APACHE_LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\w+) (\S+)[^"]*" (\d{3}) \S+(?:\s+"[^"]*")?\s+"([^"]*)"/;

// nginx log format (similar)
const NGINX_LOG_REGEX = /^(\S+) - \S+ \[([^\]]+)\] "(\w+) (\S+)[^"]*" (\d{3}) \d+\s+"[^"]*"\s+"([^"]*)"/;

export function parseCrawlerLogs(
  logContent: string,
  knownBots?: string[],
): CrawlerLogReport {
  const lines = logContent.split('\n').filter(Boolean);
  const visits: CrawlerVisit[] = [];

  for (const line of lines) {
    const match = APACHE_LOG_REGEX.exec(line) ?? NGINX_LOG_REGEX.exec(line);
    if (!match) continue;

    const [, ip, dateStr, , url, statusStr, userAgent] = match;
    const statusCode = parseInt(statusStr, 10);

    // Identify bot
    const bot = identifyBot(userAgent);
    if (!bot) continue;

    visits.push({
      timestamp: parseLogDate(dateStr),
      bot,
      url,
      statusCode,
      userAgent,
      ip,
    });
  }

  return buildReport(visits, knownBots);
}



export async function parseCrawlerLogsAsync(
  logContent: string,
  knownBots?: string[],
): Promise<CrawlerLogReport> {
  const lines = logContent.split('\n').filter(Boolean);
  const visits: CrawlerVisit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = APACHE_LOG_REGEX.exec(line) ?? NGINX_LOG_REGEX.exec(line);
    if (!match) continue;

    const [, ip, dateStr, , url, statusStr, userAgent] = match;
    const statusCode = parseInt(statusStr, 10);

    const bot = identifyBot(userAgent);
    if (!bot) continue;

    visits.push({
      timestamp: parseLogDate(dateStr),
      bot,
      url,
      statusCode,
      userAgent,
      ip,
    });

    if (i > 0 && i % 500 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  return buildReport(visits, knownBots);
}
function identifyBot(userAgent: string): string | null {
  for (const [name, pattern] of Object.entries(AI_BOT_PATTERNS)) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

function parseLogDate(dateStr: string): Date {
  // Format: 10/Oct/2000:13:55:36 -0700
  const cleaned = dateStr.replace(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})/, '$2 $1, $3 $4');
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? new Date() : date;
}

function buildReport(visits: CrawlerVisit[], knownBots?: string[]): CrawlerLogReport {
  // Bot breakdown
  const botBreakdown: Record<string, { visits: number; uniquePages: Set<string>; lastSeen: Date }> = {};

  for (const visit of visits) {
    if (!botBreakdown[visit.bot]) {
      botBreakdown[visit.bot] = { visits: 0, uniquePages: new Set(), lastSeen: visit.timestamp };
    }
    botBreakdown[visit.bot].visits++;
    botBreakdown[visit.bot].uniquePages.add(visit.url);
    if (visit.timestamp > botBreakdown[visit.bot].lastSeen) {
      botBreakdown[visit.bot].lastSeen = visit.timestamp;
    }
  }

  // Top pages by visit count
  const pageVisits = new Map<string, { visits: number; bots: Set<string> }>();
  for (const visit of visits) {
    const existing = pageVisits.get(visit.url) ?? { visits: 0, bots: new Set() };
    existing.visits++;
    existing.bots.add(visit.bot);
    pageVisits.set(visit.url, existing);
  }

  const topPages = Array.from(pageVisits.entries())
    .map(([url, data]) => ({ url, visits: data.visits, bots: [...data.bots] }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20);

  // Daily trend
  const dailyCounts = new Map<string, number>();
  for (const visit of visits) {
    const day = visit.timestamp.toISOString().slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
  }

  const dailyTrend = Array.from(dailyCounts.entries())
    .map(([date, visits]) => ({ date, visits }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Detect new bots
  const knownSet = new Set(knownBots ?? []);
  const detectedBots = Object.keys(botBreakdown);
  const newBots = detectedBots.filter((b) => !knownSet.has(b));

  // Unique pages
  const allPages = new Set<string>();
  for (const visit of visits) allPages.add(visit.url);

  return {
    totalVisits: visits.length,
    uniquePages: allPages.size,
    botBreakdown: Object.fromEntries(
      Object.entries(botBreakdown).map(([bot, data]) => [
        bot,
        {
          visits: data.visits,
          uniquePages: data.uniquePages.size,
          lastSeen: data.lastSeen.toISOString(),
        },
      ]),
    ),
    topPages,
    dailyTrend,
    newBots,
  };
}
