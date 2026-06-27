import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    // In production on Vercel, API calls go to the Render backend directly.
    // In dev, we can proxy to localhost:8000.
    return process.env.NODE_ENV === "development"
      ? [{ source: "/api-proxy/:path*", destination: "http://localhost:8000/:path*" }]
      : [];
  },
};

export default nextConfig;
