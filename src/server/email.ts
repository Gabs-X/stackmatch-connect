/**
 * Sends e-mails through Resend when RESEND_API_KEY is set. Without it (development and tests),
 * each e-mail is written to the server log and kept in memory, where the end-to-end tests read
 * the codes; in production that is an error, since nobody would receive anything.
 */
export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Where replies go instead of the sender: a company's contact, for messages it sends. */
  replyTo?: string;
};

const store = globalThis as unknown as { __stackmatchOutbox?: Email[] };

/** E-mails "sent" without Resend, newest last. */
export const outbox = () => (store.__stackmatchOutbox ??= []);

/** Sender shown in the inbox; Resend only accepts addresses of a domain verified there. */
const defaultFrom = "StackMatch <onboarding@resend.dev>";

export async function sendEmail(email: Email) {
  const key = process.env["RESEND_API_KEY"]?.trim();
  if (!key) {
    if (process.env["NODE_ENV"] === "production")
      throw new Error("No e-mail service: set RESEND_API_KEY in production to send e-mails.");
    console.info(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    outbox().push(email);
    if (outbox().length > 50) outbox().shift();
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env["EMAIL_FROM"]?.trim() || defaultFrom,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  if (!response.ok)
    throw new Error(`Resend refused the e-mail (${response.status}): ${await response.text()}`);
}

export type EmailLanguage = "pt" | "en";

const copy = {
  pt: {
    verify: {
      subject: "Seu código de confirmação do StackMatch",
      intro: "Use este código para confirmar seu e-mail no StackMatch:",
    },
    reset: {
      subject: "Seu código para redefinir a senha do StackMatch",
      intro: "Use este código para criar uma nova senha no StackMatch:",
    },
    expires: (minutes: number) => `O código vale por ${minutes} minutos.`,
    ignore: "Se não foi você, ignore este e-mail.",
  },
  en: {
    verify: {
      subject: "Your StackMatch confirmation code",
      intro: "Use this code to confirm your e-mail on StackMatch:",
    },
    reset: {
      subject: "Your StackMatch password reset code",
      intro: "Use this code to set a new password on StackMatch:",
    },
    expires: (minutes: number) => `The code is valid for ${minutes} minutes.`,
    ignore: "If this wasn't you, ignore this e-mail.",
  },
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The e-mail with a confirmation or password reset code. */
export function codeEmail(
  to: string,
  kind: "verify" | "reset",
  code: string,
  minutes: number,
  language: EmailLanguage,
): Email {
  const text = copy[language];
  const lines = [text[kind].intro, code, text.expires(minutes), text.ignore];
  return {
    to,
    subject: text[kind].subject,
    text: lines.join("\n\n"),
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>${escapeHtml(text[kind].intro)}</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${escapeHtml(code)}</p>
<p>${escapeHtml(text.expires(minutes))}</p>
<p style="color:#666">${escapeHtml(text.ignore)}</p>
</div>`,
  };
}

/**
 * A message e-mail: paragraphs, then an optional quote (what someone wrote) and link button, then
 * a closing line; the text and HTML versions say the same.
 */
export function messageEmail({
  to,
  subject,
  paragraphs,
  quote,
  action,
  closing,
  replyTo,
}: {
  to: string;
  subject: string;
  paragraphs: string[];
  quote?: string;
  action?: { label: string; url: string };
  closing: string;
  replyTo?: string;
}): Email {
  const text = [
    ...paragraphs,
    ...(quote ? [quote.replace(/^/gm, "> ")] : []),
    ...(action ? [`${action.label}: ${action.url}`] : []),
    closing,
  ].join("\n\n");
  const blocks = [
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(quote
      ? [
          `<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px;color:#555">${escapeHtml(quote)}</p>`,
        ]
      : []),
    ...(action
      ? [
          `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(action.label)}</a></p>`,
        ]
      : []),
    `<p style="color:#666">${escapeHtml(closing)}</p>`,
  ];
  return {
    to,
    subject,
    text,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">\n${blocks.join("\n")}\n</div>`,
    ...(replyTo ? { replyTo } : {}),
  };
}
