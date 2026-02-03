/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable body parsing for Stripe webhooks
  async rewrites() {
    return []
  },
}

export default nextConfig
