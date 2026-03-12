import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

let scanQueueInstance: Queue | null = null;
let crawlQueueInstance: Queue | null = null;

export function getScanQueue(): Queue {
  if (!scanQueueInstance) {
    scanQueueInstance = new Queue('scan', { connection });
  }
  return scanQueueInstance;
}

export function getCrawlQueue(): Queue {
  if (!crawlQueueInstance) {
    crawlQueueInstance = new Queue('crawl', { connection });
  }
  return crawlQueueInstance;
}
