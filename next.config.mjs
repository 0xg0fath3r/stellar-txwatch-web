import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'stellar.expert' },
    ],
  },
}

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: true,
  // Upload source maps only when an auth token is present (e.g. in CI).
  sourcemaps: {
    disable: !sentryAuthToken,
  },
  // Disable source map upload when no auth token is available.
  disableServerWebpackPlugin: !sentryAuthToken,
  disableClientWebpackPlugin: !sentryAuthToken,
}

const config = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig

export default config