import { PostHog } from "posthog-node";

// Module-level singleton so warm serverless invocations reuse one client
// instead of opening a new one per request.
let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    });
  }
  return client;
}

// Serverless functions can freeze immediately after the response is sent, so
// this awaits captureExceptionImmediate rather than the fire-and-forget
// captureException + a separate flush() — the event is actually sent before
// this resolves, not just queued.
export async function captureServerException(error: unknown, context?: Record<string, unknown>) {
  const ph = getClient();
  if (!ph) return;
  try {
    await ph.captureExceptionImmediate(error, undefined, context);
  } catch {
    // Never let error-reporting itself break the caller's error handling.
  }
}
