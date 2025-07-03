// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      'yvqjenjoahwnobhscdbi.supabase.co' // Domaine Supabase Storage pour les covers d’événement
    ],
  },
};

module.exports = nextConfig;
