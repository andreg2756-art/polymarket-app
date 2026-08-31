// Runs before React hydration (Next.js instrumentation-client convention),
// making it the right place to initialize error/analytics capture so it's
// live for the earliest possible client-side exceptions.
import posthog from "posthog-js";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_exceptions: true,
  });
}
