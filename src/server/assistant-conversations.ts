import { eq } from "drizzle-orm";
import { z } from "zod";
import { maxStoredMessages } from "@/lib/assistant";
import type { Db } from "./db";
import { assistantConversations } from "./db/schema";

/** The chat kept per account: the latest messages, enough to pick the conversation up again. */
export const storedConversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(20_000),
    }),
  )
  .max(maxStoredMessages);

export type StoredConversation = z.infer<typeof storedConversationSchema>;

export async function loadConversation(db: Db, userId: string): Promise<StoredConversation> {
  const [row] = await db
    .select({ messages: assistantConversations.messages })
    .from(assistantConversations)
    .where(eq(assistantConversations.userId, userId))
    .limit(1);
  return row?.messages ?? [];
}

/** Replaces the account's chat; an empty one deletes it ("New conversation"). */
export async function saveConversation(db: Db, userId: string, messages: StoredConversation) {
  if (messages.length === 0) {
    await db.delete(assistantConversations).where(eq(assistantConversations.userId, userId));
    return;
  }
  const updatedAt = new Date();
  await db
    .insert(assistantConversations)
    .values({ userId, messages, updatedAt })
    .onConflictDoUpdate({ target: assistantConversations.userId, set: { messages, updatedAt } });
}
