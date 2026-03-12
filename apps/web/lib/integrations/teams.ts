/**
 * Microsoft Teams notification integration.
 *
 * Sends adaptive card notifications via Teams webhook connectors.
 */

import { safeOutboundRequest } from '@/lib/safe-outbound-request';

export interface TeamsConfig {
  webhookUrl: string;
  enabled: boolean;
}

export async function sendTeamsNotification(
  config: TeamsConfig,
  card: TeamsAdaptiveCard,
): Promise<boolean> {
  if (!config.enabled || !config.webhookUrl) return false;

  try {
    const res = await safeOutboundRequest(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: card,
          },
        ],
      }),
      timeoutMs: 5000,
    });

    await res.body.dump();
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export interface TeamsAdaptiveCard {
  $schema: string;
  type: string;
  version: string;
  body: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
}

export function buildScanCompleteCard(data: {
  url: string;
  score: number;
  tier: string;
  projectName: string;
  dashboardUrl: string;
}): TeamsAdaptiveCard {
  const tierColor: Record<string, string> = {
    authority: 'good',
    extractable: 'accent',
    readable: 'warning',
    invisible: 'attention',
  };

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        size: 'medium',
        weight: 'bolder',
        text: 'AI Visibility Scan Complete',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'URL', value: data.url },
          { title: 'Project', value: data.projectName },
          { title: 'Score', value: `${data.score}/100` },
          { title: 'Tier', value: data.tier },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Results',
        url: data.dashboardUrl,
      },
    ],
  };
}

export function buildScoreAlertCard(data: {
  url: string;
  previousScore: number;
  currentScore: number;
  title: string;
  severity: string;
}): TeamsAdaptiveCard {
  const delta = data.currentScore - data.previousScore;
  const direction = delta > 0 ? '+' : '';

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        size: 'medium',
        weight: 'bolder',
        text: data.title,
        color: data.severity === 'critical' ? 'attention' : data.severity === 'warning' ? 'warning' : 'default',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'URL', value: data.url },
          { title: 'Score Change', value: `${data.previousScore} → ${data.currentScore} (${direction}${delta})` },
        ],
      },
    ],
  };
}
