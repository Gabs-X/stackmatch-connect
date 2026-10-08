/**
 * The small Markdown subset the assistant writes, parsed into a tree the chat renders without
 * HTML: paragraphs, bulleted and numbered lists, **bold**, `code` and links to app screens, which
 * become buttons. Anything else stays as plain text, so a reply mid-stream (an unclosed "**") reads
 * fine until the rest arrives.
 */

/** Screens the assistant may send people to. Links to other addresses render as plain text. */
export const assistantPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/discover",
  "/saved",
  "/jobs",
  "/jobs/new",
  "/create-profile",
  "/interests",
  "/company-settings",
  "/account",
  "/support",
  "/terms",
] as const;

export type AssistantPath = (typeof assistantPaths)[number];

const isAssistantPath = (path: string): path is AssistantPath =>
  (assistantPaths as readonly string[]).includes(path);

export type Inline =
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "code"; text: string }
  | { kind: "link"; label: string; to: AssistantPath };

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "list"; ordered: boolean; start: number; items: Inline[][] };

const inlinePattern = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|`([^`\n]+)`/g;

export function parseInline(text: string, bold = false): Inline[] {
  const nodes: Inline[] = [];
  const pushText = (value: string, strong = bold) => {
    if (!value) return;
    const previous = nodes.at(-1);
    if (previous?.kind === "text" && previous.bold === strong) previous.text += value;
    else nodes.push({ kind: "text", text: value, bold: strong });
  };
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    pushText(text.slice(last, match.index));
    last = match.index + match[0].length;
    const [, strong, label, href, code] = match;
    if (strong !== undefined) {
      for (const node of parseInline(strong, true)) {
        if (node.kind === "text") pushText(node.text, node.bold);
        else nodes.push(node);
      }
    } else if (label !== undefined && href !== undefined) {
      if (isAssistantPath(href)) nodes.push({ kind: "link", label, to: href });
      else pushText(label);
    } else if (code !== undefined) {
      nodes.push({ kind: "code", text: code });
    }
  }
  pushText(text.slice(last));
  return nodes;
}

const bulletPattern = /^\s*[-*•]\s+(.*)$/;
const numberPattern = /^\s*(\d+)[.)]\s+(.*)$/;
const headingPattern = /^\s*#{1,6}\s+(.*)$/;

export function parseAssistantMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const close = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const line of text.split("\n")) {
    const bullet = bulletPattern.exec(line);
    const number = bullet ? null : numberPattern.exec(line);
    if (bullet || number) {
      const ordered = Boolean(number);
      const content = (number ? number[2] : bullet?.[1]) ?? "";
      if (current?.kind !== "list" || current.ordered !== ordered) {
        close();
        current = { kind: "list", ordered, start: number ? Number(number[1]) : 1, items: [] };
      }
      current.items.push(parseInline(content));
    } else if (!line.trim()) {
      close();
    } else {
      // Headings aren't asked for, but if one comes, show it as a bold line.
      const heading = headingPattern.exec(line);
      const inline = heading ? parseInline(heading[1] ?? "", true) : parseInline(line.trim());
      if (current?.kind !== "paragraph") {
        close();
        current = { kind: "paragraph", lines: [] };
      }
      current.lines.push(inline);
    }
  }
  close();
  return blocks;
}
