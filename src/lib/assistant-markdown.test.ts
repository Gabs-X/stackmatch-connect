import { describe, expect, it } from "vitest";
import { parseAssistantMarkdown, parseInline } from "./assistant-markdown";

describe("parseInline", () => {
  it("marks bold text and keeps the rest plain", () => {
    expect(parseInline("Use o **Discover** para filtrar.")).toEqual([
      { kind: "text", text: "Use o ", bold: false },
      { kind: "text", text: "Discover", bold: true },
      { kind: "text", text: " para filtrar.", bold: false },
    ]);
  });

  it("turns links to app screens into links and others into their label", () => {
    expect(parseInline("[Abrir o Discover](/discover) ou [site](https://evil.test)")).toEqual([
      { kind: "link", label: "Abrir o Discover", to: "/discover" },
      { kind: "text", text: " ou site", bold: false },
    ]);
    expect(parseInline("[Perfil](/developer/123)")).toEqual([
      { kind: "text", text: "Perfil", bold: false },
    ]);
  });

  it("reads links and code inside bold", () => {
    expect(parseInline("**Vá em [Conta](/account) e use `Salvar`**")).toEqual([
      { kind: "text", text: "Vá em ", bold: true },
      { kind: "link", label: "Conta", to: "/account" },
      { kind: "text", text: " e use ", bold: true },
      { kind: "code", text: "Salvar" },
    ]);
  });

  it("leaves unfinished markup as text while the reply streams", () => {
    expect(parseInline("Clique em **Sal")).toEqual([
      { kind: "text", text: "Clique em **Sal", bold: false },
    ]);
    expect(parseInline("[Abrir](/disc")).toEqual([
      { kind: "text", text: "[Abrir](/disc", bold: false },
    ]);
  });
});

describe("parseAssistantMarkdown", () => {
  it("splits paragraphs, line breaks and lists", () => {
    const blocks = parseAssistantMarkdown(
      "Olá, Ana!\nVeja como:\n\n1. Abra o menu\n2. Clique em **Conta**\n\n- Dica um\n* Dica dois\n## Pronto",
    );
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "list", "list", "paragraph"]);
    expect(blocks[0]).toMatchObject({ kind: "paragraph", lines: [[{ text: "Olá, Ana!" }], [{}]] });
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: true, start: 1 });
    expect(blocks[1]?.kind === "list" && blocks[1].items[1]).toEqual([
      { kind: "text", text: "Clique em ", bold: false },
      { kind: "text", text: "Conta", bold: true },
    ]);
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ lines: [[{ text: "Pronto", bold: true }]] });
  });

  it("keeps the number a list starts at", () => {
    expect(parseAssistantMarkdown("3) Terceiro passo")[0]).toMatchObject({ start: 3 });
  });
});
