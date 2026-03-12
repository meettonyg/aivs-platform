import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@aivs/ui', '@aivs/types', '@aivs/scanner-engine', '@aivs/db'],
};

export default nextConfig;
