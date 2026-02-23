import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "levelsgov.xyz" }],
        destination: "https://levelsgov.fyi/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
