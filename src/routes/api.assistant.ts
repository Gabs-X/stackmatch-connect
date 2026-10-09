import { createFileRoute } from "@tanstack/react-router";
import {
  assistantClient,
  assistantReply,
  firstNameOf,
  parseAssistantRequest,
} from "@/server/assistant";
import { assistantBudgetWait, recordAssistantSpend } from "@/server/assistant-budget";
import { assistantLimitFor, recordAssistantRequest } from "@/server/assistant-throttle";
import { clientIp, currentUser, database } from "@/server/session";

/**
 * Turns the reply into a text stream. The first chunk is already read, so failures before any
 * text become an error status instead of a broken stream.
 */
function textStream(reply: AsyncGenerator<string>, first: IteratorResult<string>) {
  const encoder = new TextEncoder();
  let pending: IteratorResult<string> | null = first;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = pending ?? (await reply.next());
        pending = null;
        if (result.done) controller.close();
        else controller.enqueue(encoder.encode(result.value));
      } catch (error) {
        console.error("Assistant reply failed mid-stream:", error);
        controller.error(error);
      }
    },
    async cancel() {
      await reply.return(undefined);
    },
  });
}

/**
 * The support assistant's backend (src/server/assistant.ts). Receives the conversation as JSON and
 * streams the reply as plain text, the contract of createHttpTransport in src/lib/assistant.ts.
 */
export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only accounts chat with Ada; visitors are asked to sign in or create one.
        const user = await currentUser();
        if (!user) return new Response("Sign in to chat", { status: 401 });

        const client = assistantClient();
        if (!client) return new Response("Assistant not configured", { status: 503 });

        const body = parseAssistantRequest(await request.json().catch(() => null));
        if (!body) return new Response("Invalid conversation", { status: 400 });

        const db = await database();
        const ip = clientIp();
        const wait = await assistantLimitFor(db, ip);
        if (wait > 0)
          return new Response("Too many questions", {
            status: 429,
            headers: { "Retry-After": String(wait) },
          });
        // The month's spending cap: paused until the next month once it's reached.
        const paused = await assistantBudgetWait(db);
        if (paused > 0)
          return new Response("Assistant paused", {
            status: 503,
            headers: { "Retry-After": String(paused) },
          });
        await recordAssistantRequest(db, ip);

        const account = {
          accountType: user.accountType,
          emailVerified: user.emailVerified,
          firstName: firstNameOf(user.name),
        };
        const reply = assistantReply(client, body, account, request.signal, (usage) =>
          recordAssistantSpend(db, usage),
        );
        let first: IteratorResult<string>;
        try {
          first = await reply.next();
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Assistant reply failed:", error);
          return new Response("Assistant unavailable", { status: 502 });
        }
        return new Response(textStream(reply, first), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
