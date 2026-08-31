import type { Instrumentation } from "next";

// Global hook for uncaught server-side errors (Server Components, Route
// Handlers, Server Actions) that never reach an explicit try/catch. Route
// Handlers that already catch and report their own errors (e.g.
// app/api/stocks/refresh/route.ts) call lib/posthog-server.ts directly
// instead, since a caught-and-handled error never reaches this hook.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureServerException } = await import("@/lib/posthog-server");
  await captureServerException(err, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
