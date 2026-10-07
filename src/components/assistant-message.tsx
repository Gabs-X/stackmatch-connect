import { ArrowRight } from "lucide-react";
import { Fragment, useMemo } from "react";
import { parseAssistantMarkdown, type AssistantPath, type Inline } from "@/lib/assistant-markdown";

function InlineNodes({
  nodes,
  onNavigate,
}: {
  nodes: Inline[];
  onNavigate: (to: AssistantPath) => void;
}) {
  return nodes.map((node, index) => {
    if (node.kind === "link")
      return (
        <button
          key={index}
          type="button"
          className="mx-0.5 my-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-card px-3 py-1 align-middle text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onNavigate(node.to)}
        >
          {node.label}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      );
    if (node.kind === "code")
      return (
        <code key={index} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.8em]">
          {node.text}
        </code>
      );
    return node.bold ? (
      <strong key={index} className="font-semibold">
        {node.text}
      </strong>
    ) : (
      <Fragment key={index}>{node.text}</Fragment>
    );
  });
}

/** An assistant reply: its Markdown as paragraphs and lists, with screen links as buttons. */
export function AssistantMessage({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate: (to: AssistantPath) => void;
}) {
  const blocks = useMemo(() => parseAssistantMarkdown(content), [content]);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((block, index) => {
        if (block.kind === "paragraph")
          return (
            <p key={index}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  <InlineNodes nodes={line} onNavigate={onNavigate} />
                </Fragment>
              ))}
            </p>
          );
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={index}
            start={block.ordered ? block.start : undefined}
            className={block.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineNodes nodes={item} onNavigate={onNavigate} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
