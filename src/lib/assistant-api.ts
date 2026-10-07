import { createServerFn } from "@tanstack/react-start";
import {
  loadConversation,
  saveConversation,
  storedConversationSchema,
} from "@/server/assistant-conversations";
import { AccessError, currentUser, database } from "@/server/session";

async function signedInUser() {
  const user = await currentUser();
  if (!user) throw new AccessError();
  return user;
}

/** Stands for `GET /me/assistant`: the signed-in account's assistant chat. */
export const fetchAssistantConversation = createServerFn({ method: "GET" }).handler(async () =>
  loadConversation(await database(), (await signedInUser()).id),
);

/** Stands for `PUT /me/assistant`; an empty list clears the chat. */
export const saveAssistantConversationFn = createServerFn({ method: "POST" })
  .validator(storedConversationSchema)
  .handler(async ({ data }) => {
    await saveConversation(await database(), (await signedInUser()).id, data);
  });
