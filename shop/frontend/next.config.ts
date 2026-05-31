import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isSSR = process.env.NEXT_BUILD_SSR === "true";

const nextConfig: NextConfig = {
  output: isSSR ? undefined : "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during bundling
  silent: true,
  org: "ozgursistemorg",
  project: "shop-frontend",
  
  // Disable uploading source maps if there is no auth token to avoid build crashes
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
}, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Hides source maps from visitors
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});
