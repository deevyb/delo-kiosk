/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for iPad kiosk usage
  reactStrictMode: true,

  // Prevent browser caching on dynamic routes (order, kitchen)
  // This ensures admin changes (like toggling drinks) appear immediately
  async headers() {
    return [
      {
        source: '/order',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/kitchen',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
