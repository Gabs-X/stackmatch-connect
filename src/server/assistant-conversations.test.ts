import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { maxSentMessages, maxStoredMessages, requestMessages } from "@/lib/assistant";
import {
  loadConversation,
  saveConversation,
  storedConversationSchema,
} from "./assistant-conversations";
import type { Db } from "./db";
import { users } from "./db/schema";
import { createDeveloper, createTestDb } from "./test-db";

let db: Db;
let ana: string;
let bia: string;

beforeEach(async () => {
  db = await createTestDb();
  ana = await createDeveloper(db, "ana@example.com", "Ana Souza");
  bia = await createDeveloper(db, "bia@example.com", "Bia Lima");
});

const chat = [
  { role: "user" as const, content: "Como salvo um perfil?" },
  { role: "assistant" as const, content: "Use o **Discover**." },
];

describe("assistant conversations", () => {
  it("keeps each account's chat apart and replaces it on save", async () => {
    expect(await loadConversation(db, ana)).toEqual([]);
    await saveConversation(db, ana, chat);
    expect(await loadConversation(db, ana)).toEqual(chat);
    expect(await loadConversation(db, bia)).toEqual([]);

    await saveConversation(db, ana, chat.slice(0, 1));
    expect(await loadConversation(db, ana)).toEqual(chat.slice(0, 1));
  });

  it("deletes the chat when saved empty", async () => {
    await saveConversation(db, ana, chat);
    await saveConversation(db, ana, []);
    expect(await loadConversation(db, ana)).toEqual([]);
  });

  it("goes away with the account", async () => {
    await saveConversation(db, ana, chat);
    await db.delete(users).where(eq(users.id, ana));
    expect(await loadConversation(db, ana)).toEqual([]);
  });

  it("accepts only well-formed chats up to the stored size", () => {
    const many = Array.from({ length: maxStoredMessages + 1 }, () => chat[0]);
    expect(storedConversationSchema.safeParse(chat).success).toBe(true);
    expect(storedConversationSchema.safeParse(many).success).toBe(false);
    expect(storedConversationSchema.safeParse([{ role: "system", content: "x" }]).success).toBe(
      false,
    );
    expect(storedConversationSchema.safeParse([{ role: "user", content: "" }]).success).toBe(false);
  });
});

describe("requestMessages", () => {
  it("sends the latest messages, starting at one of the person's", () => {
    const long = Array.from({ length: maxSentMessages + 5 }, (_, index) => ({
      id: String(index),
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `m${index}`,
    }));
    const sent = requestMessages([
      ...long,
      { id: "x", role: "assistant", content: "", error: false },
    ]);
    expect(sent.length).toBeLessThanOrEqual(maxSentMessages);
    expect(sent[0]?.role).toBe("user");
    expect(sent.at(-1)?.content).toBe(`m${maxSentMessages + 4}`);
  });

  it("leaves out failed replies", () => {
    expect(
      requestMessages([
        { id: "1", role: "user", content: "Oi" },
        { id: "2", role: "assistant", content: "Erro", error: true },
        { id: "3", role: "user", content: "Oi de novo" },
      ]).map((message) => message.content),
    ).toEqual(["Oi", "Oi de novo"]);
  });
});
