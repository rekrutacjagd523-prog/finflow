import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Temporary: Next 15 lints during `next build`. Removed in Task A3 (the option
  // does not exist in Next 16, where `npm run lint` is the only lint gate).
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
    ]
  },
}

export default nextConfig
