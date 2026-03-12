/**
 * AIVS Worker — BullMQ job processor for scan and crawl jobs.
 *
 * Consumes jobs from Redis queues and runs the scanner engine.
 * Deployed as a standalone container (see Dockerfile).
 */

import { Worker } from 'bullmq';
// import { scanUrl } from '@aivs/scanner-engine';
// import { prisma } from '@aivs/db';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

console.log('AIVS Worker starting...');
console.log(`Connecting to Redis: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}`);

// TODO: Implement job handlers
// - scan: Single URL scan
// - crawl: Site-wide crawl (parent job → child jobs per URL)
// - authority: Domain authority check via external APIs (Phase 3)
// - deep-scan: LLM-powered analysis (Phase 4)

console.log('AIVS Worker ready. Waiting for jobs...');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
