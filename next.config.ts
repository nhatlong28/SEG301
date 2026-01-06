import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  // Image optimization for external domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'down-vn.img.susercontent.com' }, // Shopee
      { protocol: 'https', hostname: '*.tikicdn.com' }, // Tiki
      { protocol: 'https', hostname: '*.lazcdn.com' }, // Lazada
      { protocol: 'https', hostname: '*.cellphones.com.vn' }, // CellphoneS
      { protocol: 'https', hostname: '*.dienmayxanh.com' }, // DMX
      { protocol: 'https', hostname: '*.thegioididong.com' }, // TGDD
      { protocol: 'https', hostname: '*.tgdd.vn' }, // TGDD & DMX CDN
    ],
  },

  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
