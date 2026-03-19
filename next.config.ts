import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "levelsgov.fyi" }],
        destination: "https://levelsgov.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
