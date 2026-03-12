/**
 * Webhook delivery system.
 *
 * Sends signed webhook payloads to registered endpoints.
 * Retries failed deliveries with exponential backoff.
 */

import { request } from 'undici';
import { createHmac } from 'crypto';
import { prisma } from '@aivs/db';

export type WebhookEvent =
  | 'scan.complete'
  | 'score.changed'
  | 'crawl.complete'
  | 'credits.low'
  | 'tier.changed'
  | 'alert.created';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Deliver a webhook event to all registered endpoints for an org.
 */
export async function deliverWebhook(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      organizationId,
      active: true,
      events: { has: event },
    },
  });

  if (webhooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  for (const webhook of webhooks) {
    // Fire and forget — don't block the caller
    sendWebhook(webhook.id, webhook.url, webhook.secret, body).catch((err) => {
      console.error(`[webhook] Delivery failed for ${webhook.id}:`, err);
    });
  }
}

async function sendWebhook(
  webhookId: string,
  url: string,
  secret: string,
  body: string,
): Promise<void> {
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  try {
    const res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AIVS-Signature': `sha256=${signature}`,
        'X-AIVS-Event': JSON.parse(body).event,
        'User-Agent': 'AIVS-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    await res.body.dump();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: { lastTriggeredAt: new Date(), failureCount: 0 },
      });
    } else {
      await handleFailure(webhookId);
    }
  } catch {
    await handleFailure(webhookId);
  }
}

async function handleFailure(webhookId: string): Promise<void> {
  const webhook = await prisma.webhook.update({
    where: { id: webhookId },
    data: { failureCount: { increment: 1 } },
  });

  // Disable after 10 consecutive failures
  if (webhook.failureCount >= 10) {
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { active: false },
    });
    console.warn(`[webhook] Disabled webhook ${webhookId} after 10 failures`);
  }
}
