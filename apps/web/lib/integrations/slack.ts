/**
 * Slack notification integration.
 *
 * Sends rich notifications to Slack channels via incoming webhooks.
 * Supports: scan complete, score alerts, weekly digests, crawl complete.
 */

import { safeOutboundRequest } from '@/lib/safe-outbound-request';

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  enabled: boolean;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text: string }[];
  accessory?: Record<string, unknown>;
}

export async function sendSlackNotification(
  config: SlackConfig,
  message: SlackMessage,
): Promise<boolean> {
  if (!config.enabled || !config.webhookUrl) return false;

  try {
    const res = await safeOutboundRequest(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: config.channel,
        blocks: message.blocks,
        text: message.fallbackText,
      }),
      timeoutMs: 5000,
    });

    await res.body.dump();
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export interface SlackMessage {
  blocks: SlackBlock[];
  fallbackText: string;
}

export function buildScanCompleteMessage(data: {
  url: string;
  score: number;
  tier: string;
  projectName: string;
  dashboardUrl: string;
}): SlackMessage {
  const tierEmoji: Record<string, string> = {
    authority: ':white_check_mark:',
    extractable: ':large_blue_circle:',
    readable: ':large_orange_circle:',
    invisible: ':red_circle:',
  };

  return {
    fallbackText: `Scan complete: ${data.url} — Score ${data.score} (${data.tier})`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'AI Visibility Scan Complete', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*URL:*\n${data.url}` },
          { type: 'mrkdwn', text: `*Project:*\n${data.projectName}` },
          { type: 'mrkdwn', text: `*Score:*\n${data.score}/100` },
          { type: 'mrkdwn', text: `*Tier:*\n${tierEmoji[data.tier] ?? ''} ${data.tier}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'View Results' }, url: data.dashboardUrl } as unknown as { type: string; text: string },
        ],
      },
    ],
  };
}

export function buildScoreAlertMessage(data: {
  url: string;
  previousScore: number;
  currentScore: number;
  title: string;
  severity: string;
}): SlackMessage {
  const severityEmoji: Record<string, string> = {
    critical: ':rotating_light:',
    warning: ':warning:',
    info: ':information_source:',
  };

  const delta = data.currentScore - data.previousScore;
  const direction = delta > 0 ? '+' : '';

  return {
    fallbackText: `${data.title}: ${data.url} (${direction}${delta} points)`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${severityEmoji[data.severity] ?? ''} ${data.title}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*URL:*\n${data.url}` },
          { type: 'mrkdwn', text: `*Score Change:*\n${data.previousScore} → ${data.currentScore} (${direction}${delta})` },
        ],
      },
    ],
  };
}

export function buildWeeklyDigestMessage(data: {
  orgName: string;
  totalProjects: number;
  avgScore: number;
  scoreChange: number;
  topIssue: string;
  dashboardUrl: string;
}): SlackMessage {
  const direction = data.scoreChange > 0 ? '+' : '';

  return {
    fallbackText: `Weekly AEO Digest: ${data.orgName} — Avg Score ${data.avgScore}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Weekly AI Visibility Digest', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Organization:*\n${data.orgName}` },
          { type: 'mrkdwn', text: `*Projects:*\n${data.totalProjects}` },
          { type: 'mrkdwn', text: `*Avg Score:*\n${data.avgScore}/100` },
          { type: 'mrkdwn', text: `*Week Change:*\n${direction}${data.scoreChange} points` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Top Issue:* ${data.topIssue}` },
      },
    ],
  };
}
