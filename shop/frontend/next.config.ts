import type { NextConfig } from "next";

const isSSR = process.env.NEXT_BUILD_SSR === "true";

const nextConfig: NextConfig = {
  output: isSSR ? undefined : "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
