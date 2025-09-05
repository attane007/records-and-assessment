import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* no rewrites; /api/submit is proxied by an app route to backend */
};

export default nextConfig;
