import * as Sentry from "@sentry/react-native";

export { Sentry };

// No-ops until EXPO_PUBLIC_SENTRY_DSN is set (see .env.example) — lets the
// integration ship now and start reporting the moment a DSN is added.
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
