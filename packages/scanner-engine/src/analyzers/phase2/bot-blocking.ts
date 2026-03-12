/**
 * Bot blocking analyzer — WAF/CDN detection and AI bot access testing.
 * Factors 1.2, 1.3 in the AEO taxonomy.
 *
 * Simulates requests as various AI bot user agents to detect blocking.
 */

import { request } from 'undici';

export interface BotBlockingResult {
  score: number;
  browserAccessible: boolean;
  gptBotBlocked: boolean;
  claudeBotBlocked: boolean;
  perplexityBotBlocked: boolean;
  googleBotBlocked: boolean;
  bingBotBlocked: boolean;
  wafDetected: boolean;
  blockedBots: string[];
  details: Record<string, { status: number; blocked: boolean }>;
}

const BOT_USER_AGENTS: Record<string, string> = {
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://www.anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0)',
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function analyzeBotBlocking(url: string): Promise<BotBlockingResult> {
  const details: Record<string, { status: number; blocked: boolean }> = {};
  const blockedBots: string[] = [];

  // First, fetch as browser to establish baseline
  let browserAccessible = false;
  let browserStatus = 0;
  try {
    const res = await request(url, {
      method: 'GET',
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(10_000),
    });
    browserStatus = res.statusCode;
    browserAccessible = browserStatus >= 200 && browserStatus < 400;
    await res.body.dump();
  } catch {
    browserAccessible = false;
  }

  // Test each AI bot
  let wafDetected = false;
  for (const [botName, ua] of Object.entries(BOT_USER_AGENTS)) {
    try {
      const res = await request(url, {
        method: 'GET',
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(10_000),
      });

      const status = res.statusCode;
      await res.body.dump();

      // Blocked if: 403, 406, 429, or significantly different from browser response
      const blocked =
        status === 403 ||
        status === 406 ||
        status === 429 ||
        status === 451 ||
        (browserAccessible && status >= 400);

      if (blocked) {
        blockedBots.push(botName);
        if (status === 403 || status === 406) wafDetected = true;
      }

      details[botName] = { status, blocked };
    } catch {
      details[botName] = { status: 0, blocked: true };
      blockedBots.push(botName);
    }
  }

  const gptBotBlocked = details['GPTBot']?.blocked ?? false;
  const claudeBotBlocked = details['ClaudeBot']?.blocked ?? false;
  const perplexityBotBlocked = details['PerplexityBot']?.blocked ?? false;
  const googleBotBlocked = details['Googlebot']?.blocked ?? false;
  const bingBotBlocked = details['Bingbot']?.blocked ?? false;

  // Scoring
  let score = 100;

  if (!browserAccessible) score -= 50;
  if (gptBotBlocked) score -= 20;
  if (claudeBotBlocked) score -= 20;
  if (perplexityBotBlocked) score -= 15;
  if (googleBotBlocked) score -= 25;
  if (bingBotBlocked) score -= 15;
  if (wafDetected) score -= 5;

  return {
    score: Math.max(0, score),
    browserAccessible,
    gptBotBlocked,
    claudeBotBlocked,
    perplexityBotBlocked,
    googleBotBlocked,
    bingBotBlocked,
    wafDetected,
    blockedBots,
    details,
  };
}
