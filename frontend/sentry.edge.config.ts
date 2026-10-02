import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e0244b5c8e23f77353e86347944e6c46@o4511486970167296.ingest.de.sentry.io/4511486973116496",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console regarding SDK integration.
  debug: false,
});
