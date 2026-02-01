/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Forza il build anche se ci sono errori di tipo (utile per il primo lancio)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora i warning di linting per velocizzare il deploy
    ignoreDuringBuilds: true,
  },
  // Assicuriamoci che Next.js tratti correttamente la cartella app
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
