import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssistantHttpError,
  createHttpTransport,
  createMockTransport,
  type AssistantRequest,
  type AssistantTransport,
} from "./assistant";

const request: AssistantRequest = {
  messages: [{ role: "user", content: "Como funciona o Discover?" }],
  locale: "pt-BR",
  context: { pathname: "/discover" },
};

const collect = async (transport: AssistantTransport, signal = new AbortController().signal) => {
  let reply = "";
  for await (const chunk of transport(request, signal)) reply += chunk;
  return reply;
};

beforeEach(() => vi.stubGlobal("window", globalThis));
afterEach(() => vi.unstubAllGlobals());

describe("createHttpTransport", () => {
  it("posts the conversation as JSON and reads a JSON reply", async () => {
    const fetchMock = vi.fn(async () => Response.json({ reply: "Olá!" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await collect(createHttpTransport("https://api.test/assistant"))).toBe("Olá!");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/assistant");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("appends a streamed text reply as it arrives", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (const part of ["O Discover ", "mostra ", "um perfil por vez."])
          controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { headers: { "Content-Type": "text/plain" } })),
    );

    expect(await collect(createHttpTransport("https://api.test/assistant"))).toBe(
      "O Discover mostra um perfil por vez.",
    );
  });

  it("fails on error statuses and on JSON without a reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    await expect(collect(createHttpTransport("https://api.test/assistant"))).rejects.toThrow("503");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ answer: "wrong key" })),
    );
    await expect(collect(createHttpTransport("https://api.test/assistant"))).rejects.toThrow();
  });

  it("reports the wait the backend asks for when the limit is reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("slow down", { status: 429, headers: { "Retry-After": "90" } }),
      ),
    );
    const failure = collect(createHttpTransport("https://api.test/assistant"));
    await expect(failure).rejects.toBeInstanceOf(AssistantHttpError);
    await expect(failure).rejects.toMatchObject({ status: 429, retryAfter: 90 });
  });
});

describe("createMockTransport", () => {
  it("streams the fixed reply word by word", async () => {
    vi.useFakeTimers();
    const chunks: string[] = [];
    const run = (async () => {
      for await (const chunk of createMockTransport("Prévia sem IA")(
        request,
        new AbortController().signal,
      ))
        chunks.push(chunk);
    })();
    await vi.runAllTimersAsync();
    await run;
    vi.useRealTimers();
    expect(chunks).toEqual(["Prévia ", "sem ", "IA"]);
  });

  it("stops mid-reply when aborted between words", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const chunks: string[] = [];
    const run = (async () => {
      for await (const chunk of createMockTransport("uma resposta longa")(
        request,
        controller.signal,
      )) {
        chunks.push(chunk);
        // Abort while the consumer handles a chunk, as the stop button does.
        controller.abort();
      }
    })();
    const outcome = expect(run).rejects.toBeDefined();
    await vi.runAllTimersAsync();
    await outcome;
    vi.useRealTimers();
    expect(chunks).toEqual(["uma "]);
  });

  it("stops when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(collect(createMockTransport("Prévia"), controller.signal)).rejects.toBeDefined();
  });
});
