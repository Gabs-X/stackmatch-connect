import { describe, expect, it } from "vitest";
import { canonicalSkill, hasSkill, suggestSkills } from "./skill-suggestions";

// Most used first, as the server sends it.
const catalog = ["React", "TypeScript", "Node.js", "Next.js", "PostgreSQL", "Spring Boot"];

describe("suggestSkills", () => {
  it("matches any part of the name, in any case, starting matches first", () => {
    expect(suggestSkills(catalog, "js", [])).toEqual(["Node.js", "Next.js"]);
    expect(suggestSkills(catalog, "ne", [])).toEqual(["Next.js"]);
    expect(suggestSkills(catalog, "S", [])).toEqual([
      "Spring Boot",
      "TypeScript",
      "Node.js",
      "Next.js",
      "PostgreSQL",
    ]);
  });

  it("leaves out skills already chosen and suggests nothing before typing", () => {
    expect(suggestSkills(catalog, "re", ["react"])).toEqual(["PostgreSQL"]);
    expect(suggestSkills(catalog, "  ", [])).toEqual([]);
  });

  it("caps the list", () => {
    expect(suggestSkills(catalog, "s", [], 2)).toHaveLength(2);
  });
});

describe("canonicalSkill and hasSkill", () => {
  it("use the catalog's spelling and ignore case", () => {
    expect(canonicalSkill(catalog, " react ")).toBe("React");
    expect(canonicalSkill(catalog, " Elixir ")).toBe("Elixir");
    expect(hasSkill(["React"], "REACT")).toBe(true);
    expect(hasSkill(["React"], "Preact")).toBe(false);
  });
});
