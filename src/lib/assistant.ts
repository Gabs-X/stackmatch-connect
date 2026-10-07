import { useRef, useState } from "react";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  error?: boolean;
};

/** Payload sent to the backend. Keep it stable: it is the contract with the future AI service. */
export type AssistantRequest = {
  messages: { role: ChatRole; content: string }[];
  locale: "pt-BR" | "en";
  context: { pathname: string };
};

/**
 * Sends a conversation and yields the reply in chunks, so streaming and single responses share
 * one path. Implementations must stop when `signal` aborts.
 */
export type AssistantTransport = (
  request: AssistantRequest,
  signal: AbortSignal,
) => AsyncIterable<string>;

export type ChatStatus = "idle" | "streaming";

/** A reply the backend refused, with its HTTP status and, on 429, the seconds to wait. */
export class AssistantHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: number | null = null,
  ) {
    super(`Assistant request failed: ${status}`);
    this.name = "AssistantHttpError";
  }
}

/** The text shown in place of a failed reply: fixed, or chosen from the error. */
export type ErrorText = string | ((error: unknown) => string);

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    // An abort that happened between waits fires no event, so check before listening.
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** Front-end only stand-in: streams a fixed reply word by word until a backend exists. */
export function createMockTransport(reply: string): AssistantTransport {
  return async function* (_request, signal) {
    await wait(700, signal);
    for (const word of reply.split(/(?<= )/)) {
      await wait(35, signal);
      yield word;
    }
  };
}

/**
 * POSTs the request as JSON. Accepts a streamed `text/plain` body (appended as it arrives) or a
 * JSON body shaped as `{ "reply": string }`.
 */
export function createHttpTransport(url: string): AssistantTransport {
  return async function* (request, signal) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new AssistantHttpError(
        response.status,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data: unknown = await response.json();
      const reply =
        data && typeof data === "object" && "reply" in data && typeof data.reply === "string"
          ? data.reply
          : "";
      if (!reply) throw new Error("Assistant response has no reply");
      yield reply;
      return;
    }
    if (!response.body) throw new Error("Assistant response has no body");
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  };
}

export const assistantApiUrl = import.meta.env.VITE_ASSISTANT_API_URL?.trim() || undefined;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useAssistantChat(
  transport: AssistantTransport,
  getRequestMeta: () => Omit<AssistantRequest, "messages">,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const messagesRef = useRef<ChatMessage[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const update = (updater: (current: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = updater(messagesRef.current);
    setMessages(messagesRef.current);
  };
  const patchMessage = (id: string, patch: (message: ChatMessage) => ChatMessage) =>
    update((current) => current.map((message) => (message.id === id ? patch(message) : message)));

  const run = async (history: ChatMessage[], errorText: ErrorText) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const replyId = newId();
    update((current) => [...current, { id: replyId, role: "assistant", content: "" }]);
    setStatus("streaming");
    try {
      const request: AssistantRequest = {
        ...getRequestMeta(),
        messages: history
          .filter((message) => !message.error && message.content)
          .map(({ role, content }) => ({ role, content })),
      };
      for await (const chunk of transport(request, controller.signal)) {
        patchMessage(replyId, (message) => ({ ...message, content: message.content + chunk }));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const content = typeof errorText === "string" ? errorText : errorText(error);
        patchMessage(replyId, (message) => ({ ...message, content, error: true }));
      }
    } finally {
      // Drop empty replies (e.g. stopped before the first chunk) so the thread stays clean.
      update((current) =>
        current.filter((message) => message.id !== replyId || message.content.length > 0),
      );
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setStatus("idle");
      }
    }
  };

  const send = (text: string, errorText: ErrorText) => {
    const content = text.trim();
    if (!content || controllerRef.current) return;
    update((current) => [...current, { id: newId(), role: "user", content }]);
    void run(messagesRef.current, errorText);
  };

  /** Re-asks the last user message after a failed reply. */
  const retry = (errorText: ErrorText) => {
    if (controllerRef.current) return;
    update((current) => current.filter((message) => !message.error));
    void run(messagesRef.current, errorText);
  };

  const stop = () => controllerRef.current?.abort();

  const reset = () => {
    stop();
    update(() => []);
  };

  return { messages, status, send, retry, stop, reset };
}
