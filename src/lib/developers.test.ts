import { describe, expect, it } from "vitest";
import { githubAvatarUrl } from "./developers";

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
