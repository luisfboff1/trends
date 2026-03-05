import path from 'path'
import { fileURLToPath } from 'url'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = (phase) => {
  const config = {
    images: { unoptimized: true },
    generateEtags: false,
    generateBuildId: async () => `build-${Date.now()}`,
    outputFileTracingRoot: path.join(__dirname),
    turbopack: {},
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production',
    },
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    },
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            ...config.optimization.splitChunks,
            cacheGroups: {
              ...config.optimization.splitChunks?.cacheGroups,
              recharts: {
                test: /[\\/]node_modules[\\/]recharts/,
                name: 'recharts',
                chunks: 'async',
                priority: 20,
              },
              tanstack: {
                test: /[\\/]node_modules[\\/]@tanstack/,
                name: 'tanstack',
                chunks: 'async',
                priority: 15,
              },
            },
          },
        }
      }
      return config
    },
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'X-DNS-Prefetch-Control', value: 'on' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-XSS-Protection', value: '1; mode=block' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
            { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
                "style-src 'self' 'unsafe-inline' https://vercel.live",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data: https://vercel.live",
                "connect-src 'self' https://brasilapi.com.br https://viacep.com.br https://vercel.live",
                "frame-src https://vercel.live",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'"
              ].join('; ')
            }
          ],
        },
      ]
    },
  }
  return config
}

export default nextConfig
