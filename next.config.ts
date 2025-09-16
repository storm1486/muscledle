import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // apply to everything under /models/
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year, don't revalidate
          },
        ],
      },
      {
        // manifest.json can change more often
        source: "/models/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600", // 1 hour (adjust if you want)
          },
        ],
      },
    ];
  },
};

export default nextConfig;
