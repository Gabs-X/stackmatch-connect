import { describe, expect, it } from "vitest";
import { developers, githubAvatarUrl } from "./developers";

describe("githubAvatarUrl", () => {
  it("builds the public avatar address from a GitHub profile link", () => {
    expect(githubAvatarUrl("https://github.com/Gabs-X")).toBe(
      "https://github.com/Gabs-X.png?size=768",
    );
    expect(githubAvatarUrl("https://www.github.com/Gabs-X/stackmatch-connect", 200)).toBe(
      "https://github.com/Gabs-X.png?size=200",
    );
  });

  it("ignores other hosts, empty paths and invalid usernames", () => {
    expect(githubAvatarUrl("https://gitlab.com/Gabs-X")).toBeUndefined();
    expect(githubAvatarUrl("https://github.com/")).toBeUndefined();
    expect(githubAvatarUrl("https://github.com/-invalid")).toBeUndefined();
    expect(githubAvatarUrl("not a url")).toBeUndefined();
    expect(githubAvatarUrl("")).toBeUndefined();
  });
});

describe("developers catalog", () => {
  it("opens real links and the GitHub avatar only for verified profiles", () => {
    const gabriel = developers.find((developer) => developer.id === "gabriel-botelho");
    expect(gabriel?.links.verified).toBe(true);
    expect(gabriel?.image).toBe("https://github.com/Gabs-X.png?size=768");

    const fictional = developers.filter((developer) => !developer.links.verified);
    expect(fictional.length).toBeGreaterThan(0);
    for (const developer of fictional) expect(developer.image).not.toContain("github.com");
  });
});
