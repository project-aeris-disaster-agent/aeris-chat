/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Disk pack cache can get out of sync on Windows after env hot-reload / long
    // compiles (missing vendor-chunks like @tanstack, RSC "reading 'call'" errors).
    if (dev) {
      config.cache = { type: 'memory' }
    }
    config.externals = [...(config.externals || []), { canvas: 'canvas' }]
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://bagyo.app https://www.bagyo.app",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

