import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@aivs/ui', '@aivs/types', '@aivs/scanner-engine', '@aivs/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
