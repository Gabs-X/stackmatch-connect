import { describe, expect, it } from "vitest";
import { demoDeveloperProfile, developers, githubAvatarUrl } from "./developers";
import { localProfileToDeveloper } from "./local-profile";

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
  it("keeps fictional people on example links and photos", () => {
    expect(developers.length).toBeGreaterThan(0);
    for (const developer of developers) {
      expect(developer.links.verified).toBeUndefined();
      expect(developer.image).not.toContain("github.com");
    }
  });

  it("gives the demo developer account Gabriel's profile with real links and avatar", () => {
    expect(developers.some((developer) => developer.name === "Gabriel Botelho")).toBe(false);
    const gabriel = localProfileToDeveloper(demoDeveloperProfile);
    expect(gabriel).toMatchObject({ id: "local-profile", name: "Gabriel Botelho" });
    expect(gabriel.links.verified).toBe(true);
    expect(gabriel.links.website).toBe("https://gabrielanthony.vercel.app/");
    expect(gabriel.image).toBe("https://github.com/Gabs-X.png?size=768");
  });
});
