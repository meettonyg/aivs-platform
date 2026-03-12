/**
 * LLM client abstraction for Deep Scan analysis.
 *
 * Uses Claude Haiku 4.5 by default (~$0.01-0.03/page).
 * Falls back gracefully if no API key is configured.
 */

import { request } from 'undici';

export interface LlmResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Send a prompt to the configured LLM provider.
 * Returns null if no API key is configured.
 */
export async function llmAnalyze(
  systemPrompt: string,
  userContent: string,
  maxTokens = 1024,
): Promise<LlmResponse | null> {
  if (ANTHROPIC_API_KEY) {
    return callAnthropic(systemPrompt, userContent, maxTokens);
  }
  if (OPENAI_API_KEY) {
    return callOpenAI(systemPrompt, userContent, maxTokens);
  }
  return null;
}

async function callAnthropic(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<LlmResponse> {
  const res = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.body.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content?.[0]?.text ?? '',
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<LlmResponse> {
  const res = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.body.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
