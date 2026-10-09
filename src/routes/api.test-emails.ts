import { createFileRoute } from "@tanstack/react-router";
import { outbox } from "@/server/email";

/**
 * The last e-mail "sent" to an address, and the code in it, for the end-to-end tests: without
 * RESEND_API_KEY, e-mails stay in the server's memory. Only exists when the server runs with E2E=1.
 */
export const Route = createFileRoute("/api/test-emails")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (process.env["E2E"] !== "1") return new Response("Not found", { status: 404 });
        const to = new URL(request.url).searchParams.get("to")?.trim().toLowerCase() ?? "";
        const email = outbox()
          .filter((sent) => sent.to === to)
          .at(-1);
        const code = email?.text.match(/\b\d{6}\b/)?.[0] ?? null;
        return Response.json({
          subject: email?.subject ?? null,
          text: email?.text ?? null,
          replyTo: email?.replyTo ?? null,
          attachments: email?.attachments?.map((file) => file.filename) ?? [],
          code,
        });
      },
    },
  },
});
