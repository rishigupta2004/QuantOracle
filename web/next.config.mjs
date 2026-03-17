/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.dev https://*.clerk.accounts.dev",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://newsdata.io https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://api.stocktwits.com https://api.stlouisfed.org https://*.clerk.accounts.dev wss://*.supabase.co https://www.googleapis.com",
          "media-src 'self' https://www.youtube.com https://i.ytimg.com",
          "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
        ].join('; ')
      },
    ]
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
