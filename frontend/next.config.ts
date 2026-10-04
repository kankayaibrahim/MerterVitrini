import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import fs from "node:fs";
import path from "node:path";

// Determine build number (auto-incrementing) and build time (Europe/Istanbul)
let buildNumber = 1001;
const buildNumPath = path.join(__dirname, "build_number.json");

try {
  if (!process.env.__BUILD_INC_DONE) {
    process.env.__BUILD_INC_DONE = "true";
    if (fs.existsSync(buildNumPath)) {
      const parsed = JSON.parse(fs.readFileSync(buildNumPath, "utf-8"));
      buildNumber = Number(parsed.buildNumber || 1000) + 1;
    }
    fs.writeFileSync(
      buildNumPath,
      JSON.stringify({ buildNumber, updatedAt: new Date().toISOString() }, null, 2)
    );
  } else if (fs.existsSync(buildNumPath)) {
    const parsed = JSON.parse(fs.readFileSync(buildNumPath, "utf-8"));
    buildNumber = Number(parsed.buildNumber || 1000);
  }
} catch {
  // In case of read/write restrictions, fallback silently
}

const now = new Date();
const buildTimeStr = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now);

let gitCommit = "";
try {
  const gitHeadPath = path.join(__dirname, "..", ".git", "HEAD");
  if (fs.existsSync(gitHeadPath)) {
    const headContent = fs.readFileSync(gitHeadPath, "utf-8").trim();
    if (headContent.startsWith("ref: ")) {
      const refPath = path.join(__dirname, "..", ".git", headContent.slice(5).trim());
      if (fs.existsSync(refPath)) {
        gitCommit = fs.readFileSync(refPath, "utf-8").trim().slice(0, 7);
      }
    } else {
      gitCommit = headContent.slice(0, 7);
    }
  }
} catch {
  gitCommit = "";
}

const nextConfig: NextConfig = {
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: String(buildNumber),
    NEXT_PUBLIC_BUILD_TIME: buildTimeStr,
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "ozgursistemorg",
  project: "merter-frontend",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: true,
});
