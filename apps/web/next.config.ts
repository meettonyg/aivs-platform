import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@aivs/ui', '@aivs/types', '@aivs/scanner-engine', '@aivs/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/.prisma/client/**',
      './node_modules/@prisma/client/**',
      '../../node_modules/.prisma/client/**',
      '../../node_modules/@prisma/client/**',
      '../../packages/db/node_modules/.prisma/client/**',
      '../../packages/db/node_modules/@prisma/client/**',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**',
    ],
  },
};

export default nextConfig;
