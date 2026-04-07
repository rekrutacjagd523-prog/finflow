import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['firebase-admin'],
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
  webpack(config, { isServer }) {
    if (isServer) {
      // Force browser builds for Firebase packages in the server bundle.
      // This prevents the Node.js version of @firebase/firestore from being
      // included, which would pull in @grpc/grpc-js + protobufjs codegen
      // — both of which call new Function() and break in Cloudflare Workers.
      config.resolve.alias = {
        ...config.resolve.alias,
        '@firebase/firestore': path.resolve(
          __dirname,
          'node_modules/@firebase/firestore/dist/index.esm.js'
        ),
        '@firebase/firestore/lite': path.resolve(
          __dirname,
          'node_modules/@firebase/firestore/dist/lite/index.browser.esm.js'
        ),
      };
    }
    return config;
  },
};

export default nextConfig;
