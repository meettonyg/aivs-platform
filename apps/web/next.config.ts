import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@aivs/ui', '@aivs/types', '@aivs/scanner-engine', '@aivs/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingExcludes: {
    '/**': [
      './node_modules/@prisma/client/libquery_engine-*',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/libquery_engine-*',
      './node_modules/.prisma/client/libquery_engine-*',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-debian*',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-linux-arm*',
    ],
  },
  outputFileTracingIncludes: {
    '/api/**': [
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/schema.prisma',
    ],
    '/dashboard/**': [
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node',
      '../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/schema.prisma',
    ],
  },
};

export default nextConfig;
