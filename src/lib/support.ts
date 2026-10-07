import { z } from "zod";

/** What a support ticket is about; the team reads them in this order of urgency. */
export const ticketCategories = ["bug", "account", "question", "suggestion", "other"] as const;
export type TicketCategory = (typeof ticketCategories)[number];

export const ticketStatuses = ["open", "closed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

/**
 * A new ticket. Name and e-mail are how the team answers: visitors type them, and for a signed-in
 * account the server uses the account's own, whatever the form sent.
 */
export const ticketSchema = z.object({
  category: z.enum(ticketCategories),
  subject: z.string().trim().min(3, "subject-short").max(120, "subject-long"),
  message: z.string().trim().min(10, "message-short").max(4000, "message-long"),
  name: z.string().trim().min(2, "name-short").max(120),
  email: z.string().trim().toLowerCase().email("email-invalid").max(254),
  /** For signed-in accounts: send the saved chat with Ada along, so nobody has to repeat it. */
  attachConversation: z.boolean(),
  language: z.enum(["pt", "en"]),
});

export type TicketInput = z.infer<typeof ticketSchema>;

/** A ticket as its author sees it in the list. */
export type TicketSummary = {
  id: number;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  createdAt: string;
};

export type CreateTicketResult =
  { ticket: TicketSummary } | { error: "rate-limited"; retryInSeconds: number };
