import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Neon serverless driver in Edge/serverless environments
  serverExternalPackages: ['@neondatabase/serverless'],
}

export default nextConfig
