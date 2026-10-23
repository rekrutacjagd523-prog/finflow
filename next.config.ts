import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The round dev badge covers UI in screenshots (npm run ui:shots) and during reviews.
  devIndicators: false,
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
