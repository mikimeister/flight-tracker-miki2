import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false
  },
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during build
  },
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during build
  },
  // output: 'export',
  // trailingSlash: true,
  // images: {
  //   unoptimized: true
  // },
};

export default nextConfig;
