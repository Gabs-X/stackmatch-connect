import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { log, requestIdFrom, withRequestId } from "./server/log";

/**
 * Gives each request an id (the one the proxy sent, or a new one): the structured logs it writes
 * carry it (see src/server/log.ts), and so does the response, as X-Request-Id.
 */
const requestIdMiddleware = createMiddleware().server(async ({ next, request }) => {
  const requestId = requestIdFrom(request.headers);
  const result = await withRequestId(requestId, () => next());
  try {
    result.response.headers.set("x-request-id", requestId);
  } catch {
    // Some responses have immutable headers; the logs still have the id.
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    log("error", "request.failed", { path: new URL(request.url).pathname, error });
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [requestIdMiddleware, errorMiddleware, csrfMiddleware],
}));
