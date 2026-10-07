import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, MessageCircle, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AssistantMessage } from "@/components/assistant-message";
import { Button } from "@/components/ui/button";
import { useScrollingDown } from "@/hooks/use-scrolling-down";
import {
  AssistantHttpError,
  assistantApiUrl,
  createHttpTransport,
  createMockTransport,
  maxStoredMessages,
  settledMessages,
  useAssistantChat,
  type ChatMessage,
} from "@/lib/assistant";
import { fetchAssistantConversation, saveAssistantConversationFn } from "@/lib/assistant-api";
import type { AssistantPath } from "@/lib/assistant-markdown";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AssistantWidget({ raised = false }: { raised?: boolean }) {
  const { t, lang } = useI18n();
  const reduceMotion = useReducedMotion();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  // The account whose chat is shown: null for visitors, undefined until the session is known.
  const owner = ready ? (user?.id ?? null) : undefined;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const syncing = owner !== loadedFor;
  const firstName = user?.name.trim().split(/\s+/)[0];
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  // Get out of the way of what's being read; never while the chat is open or the button focused.
  const hidden = useScrollingDown() && !open && !focused;
  const [draft, setDraft] = useState("");
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Swap the mock for the HTTP transport by setting VITE_ASSISTANT_API_URL (/api/assistant).
  const transport = useMemo(
    () =>
      assistantApiUrl
        ? createHttpTransport(assistantApiUrl)
        : createMockTransport(t.assistant.previewReply),
    [t],
  );
  // Signed-in chats are kept on the server, per account; visitors' chats live only on this page.
  const persist = (conversation: ChatMessage[]) => {
    if (!ownerRef.current) return;
    const data = settledMessages(conversation)
      .slice(-maxStoredMessages)
      .map((message) => ({ ...message, content: message.content.slice(0, 20_000) }));
    void saveAssistantConversationFn({ data }).catch(() => {
      /* The chat goes on; the next reply saves it again. */
    });
  };
  const { messages, status, send, retry, stop, reset, replace } = useAssistantChat(
    transport,
    () => ({ locale: lang === "pt" ? "pt-BR" : "en", context: { pathname } }),
    persist,
  );
  // On sign-in, sign-out or a switch of account, show that account's chat (or a blank one).
  useEffect(() => {
    if (owner === undefined) return;
    replace([]);
    setDraft("");
    if (!owner) {
      setLoadedFor(null);
      return;
    }
    let current = true;
    fetchAssistantConversation()
      .then((saved) => {
        if (current) replace(saved);
      })
      .catch(() => {
        /* Start blank; the next reply saves over it. */
      })
      .finally(() => {
        if (current) setLoadedFor(owner);
      });
    return () => {
      current = false;
    };
    // Runs only when the account changes; replace works on refs, so any render's copy will do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  const startOver = () => {
    reset();
    persist([]);
  };
  const goTo = (to: AssistantPath) => {
    void navigate({ to });
    // On phones the chat covers the page; close it so the screen shows.
    if (!window.matchMedia("(min-width: 640px)").matches) setOpen(false);
  };
  const errorText = (error: unknown) =>
    error instanceof AssistantHttpError && error.status === 429
      ? t.assistant.limited(Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60)))
      : t.assistant.error;
  const streaming = status === "streaming";
  const last = messages.at(-1);
  // The reply placeholder exists from the start of a request; show dots until text arrives.
  const waitingFirstChunk = streaming && last?.role === "assistant" && !last.content;
  const visibleMessages = messages.filter((message) => message.content);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Listen on the document: focus can leave the panel (e.g. when the stop button unmounts).
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, waitingFirstChunk, reduceMotion]);

  const submit = (text = draft) => {
    if (!text.trim() || streaming || syncing) return;
    send(text, errorText);
    setDraft("");
    inputRef.current?.focus();
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.98 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            {...motionProps}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-card sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(620px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-card"
          >
            <header className="flex items-center gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <span className="assistant-avatar size-10">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate font-display text-base font-bold">
                  {t.assistant.title}
                </h2>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      assistantApiUrl ? "bg-emerald-500" : "bg-amber-500",
                    )}
                    aria-hidden="true"
                  />
                  {assistantApiUrl ? t.assistant.statusLive : t.assistant.status}
                  <span className="level-badge px-1.5 py-0 text-[0.6rem]">{t.assistant.badge}</span>
                </p>
              </div>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={t.assistant.reset}
                  title={t.assistant.reset}
                  onClick={startOver}
                >
                  <RotateCcw />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={t.assistant.close}
                onClick={close}
              >
                <X />
              </Button>
            </header>

            <div
              ref={listRef}
              className="flex-1 space-y-4 overflow-y-auto px-4 py-5"
              aria-live="polite"
              aria-busy={streaming}
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-end">
                  <span className="assistant-avatar size-12">
                    <Sparkles className="size-6" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold">
                    {firstName ? t.assistant.greetingNamed(firstName) : t.assistant.greetingTitle}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {t.assistant.greetingSub}
                  </p>
                  <p className="mt-6 text-xs font-bold uppercase text-muted-foreground">
                    {t.assistant.suggestionsLabel}
                  </p>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    {t.assistant.suggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        className="filter-chip text-left"
                        onClick={() => submit(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                visibleMessages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-6 text-primary-foreground">
                        <span className="sr-only">{t.assistant.you}: </span>
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <div key={message.id} className="flex items-end gap-2">
                      <span className="assistant-avatar size-7 shrink-0" aria-hidden="true">
                        <Sparkles className="size-3.5" />
                      </span>
                      <div className="max-w-[85%]">
                        <div
                          className={cn(
                            "break-words rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-6",
                            message.error
                              ? "whitespace-pre-wrap border border-destructive/30 bg-danger-soft text-destructive"
                              : "bg-muted text-foreground",
                          )}
                        >
                          <span className="sr-only">{t.assistant.title}: </span>
                          {message.error ? (
                            message.content
                          ) : (
                            <AssistantMessage content={message.content} onNavigate={goTo} />
                          )}
                        </div>
                        {message.error && message.id === last?.id && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-1 py-1 text-xs"
                            onClick={() => retry(errorText)}
                          >
                            <RotateCcw />
                            {t.assistant.retry}
                          </Button>
                        )}
                      </div>
                    </div>
                  ),
                )
              )}
              {waitingFirstChunk && (
                <div className="flex items-end gap-2">
                  <span className="assistant-avatar size-7 shrink-0" aria-hidden="true">
                    <Sparkles className="size-3.5" />
                  </span>
                  <span
                    className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3.5"
                    role="status"
                  >
                    <span className="sr-only">{t.assistant.typing}</span>
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        aria-hidden="true"
                        className="typing-dot"
                        style={{ animationDelay: `${dot * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <form
              className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border bg-background p-1.5 transition-colors focus-within:border-primary">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  aria-label={t.assistant.inputLabel}
                  placeholder={t.assistant.placeholder}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  className="field-sizing-content max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                {streaming ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-9 shrink-0 rounded-lg"
                    aria-label={t.assistant.stop}
                    title={t.assistant.stop}
                    onClick={() => {
                      stop();
                      inputRef.current?.focus();
                    }}
                  >
                    <Square className="fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    aria-label={t.assistant.send}
                    title={t.assistant.send}
                    disabled={!draft.trim()}
                  >
                    <ArrowUp />
                  </Button>
                )}
              </div>
              <p className="mt-2 px-1 text-center text-[0.7rem] text-muted-foreground">
                {assistantApiUrl ? t.assistant.disclaimerLive : t.assistant.disclaimer}
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? t.assistant.close : t.assistant.open}
        aria-expanded={open}
        title={open ? t.assistant.close : t.assistant.open}
        onClick={() => (open ? close() : setOpen(true))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Hidden while scrolling down: out of the tab order and the accessibility tree too.
        inert={hidden}
        className={cn(
          "assistant-fab fixed right-4 z-50 sm:bottom-6 sm:right-6",
          raised ? "bottom-[6.5rem]" : "bottom-4",
          open && "max-sm:hidden",
          hidden && "assistant-fab-hidden",
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={open ? "close" : "open"}
            initial={reduceMotion ? false : { opacity: 0, rotate: -45, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 45, scale: 0.8 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="grid place-items-center"
          >
            {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
          </motion.span>
        </AnimatePresence>
        {!open && messages.length === 0 && (
          <span className="assistant-fab-spark" aria-hidden="true">
            <Sparkles className="size-3" />
          </span>
        )}
      </button>
    </>
  );
}
