import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/generated/prisma/*.node"],
  },
};

export default nextConfig;
