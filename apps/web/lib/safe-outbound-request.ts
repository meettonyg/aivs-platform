import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [toIPv4Number('10.0.0.0'), toIPv4Number('10.255.255.255')],
  [toIPv4Number('127.0.0.0'), toIPv4Number('127.255.255.255')],
  [toIPv4Number('169.254.0.0'), toIPv4Number('169.254.255.255')],
  [toIPv4Number('172.16.0.0'), toIPv4Number('172.31.255.255')],
  [toIPv4Number('192.168.0.0'), toIPv4Number('192.168.255.255')],
  [toIPv4Number('0.0.0.0'), toIPv4Number('0.255.255.255')],
];

export interface SafeRequestOptions {
  method: string;
  headers?: HeadersInit;
  body?: BodyInit;
  timeoutMs?: number;
}

export interface SafeRequestResponse {
  statusCode: number;
  body: {
    dump: () => Promise<void>;
  };
}

export async function safeOutboundRequest(url: string, options: SafeRequestOptions): Promise<SafeRequestResponse> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Blocked outbound destination');
  }

  await assertPublicDestination(parsed.hostname);

  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    redirect: 'manual',
    signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
  });

  return {
    statusCode: response.status,
    body: {
      dump: async () => {
        await response.arrayBuffer();
      },
    },
  };
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local');
}

async function assertPublicDestination(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Blocked private IP destination');
    return;
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error('Unable to resolve outbound destination');
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error('Blocked private IP destination');
    }
  }
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const value = toIPv4Number(address);
    return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized === '::'
    );
  }

  return false;
}

function toIPv4Number(ip: string): number {
  return ip
    .split('.')
    .map((octet) => Number.parseInt(octet, 10))
    .reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}
