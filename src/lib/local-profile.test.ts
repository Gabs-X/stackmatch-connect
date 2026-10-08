import { describe, expect, it } from "vitest";
import {
  emptyProfile,
  experienceLabel,
  localProfileToDeveloper,
  missingProfileFields,
  newProject,
  profileInputSchema,
  profileLink,
} from "./local-profile";

describe("profileLink", () => {
  it("adds https to bare addresses", () => {
    expect(profileLink("github.com/ana")).toBe("https://github.com/ana");
  });

  it("keeps http and https links", () => {
    expect(profileLink(" http://ana.dev ")).toBe("http://ana.dev/");
  });

  it("rejects empty values and other protocols", () => {
    expect(profileLink("")).toBeUndefined();
    expect(profileLink("javascript:alert(1)")).toBeUndefined();
    expect(profileLink("ftp://files.ana.dev")).toBeUndefined();
  });
});

describe("newProject", () => {
  it("creates empty projects with unique ids", () => {
    const first = newProject();
    const second = newProject({ name: "Portfolio" });
    expect(first.id).not.toBe(second.id);
    expect(second).toMatchObject({ name: "Portfolio", description: "", github: "", demo: "" });
  });
});

describe("localProfileToDeveloper", () => {
  const developer = localProfileToDeveloper(
    {
      ...emptyProfile,
      name: " Ana Souza ",
      role: "Frontend Developer",
      seniority: "Pleno",
      github: "github.com/anasouza",
      linkedin: "not a link ::",
      projects: [newProject({ name: "Clinic Booking", demo: "clinic.vercel.app", github: "x y" })],
    },
    "ana-account",
  );

  it("identifies the entry by its owner's account", () => {
    expect(developer.id).toBe("ana-account");
    expect(developer.name).toBe("Ana Souza");
  });

  it("leaves fields the developer didn't answer empty", () => {
    expect(developer.hiringTypes).toEqual([]);
  });

  it("uses the GitHub avatar as the photo when a GitHub profile is filled in", () => {
    expect(developer.image).toBe("https://github.com/anasouza.png?size=768");
    expect(localProfileToDeveloper({ ...emptyProfile, name: "Ana" }, "ana").image).toBe("");
  });

  it("prefers the uploaded photo to the GitHub avatar", () => {
    const photo = "data:image/jpeg;base64,AAAA";
    expect(
      localProfileToDeveloper({ ...emptyProfile, github: "github.com/anasouza", photo }, "ana")
        .image,
    ).toBe(photo);
  });

  it("keeps only valid links", () => {
    // Typed by the developer, so they open for real instead of showing an example notice.
    expect(developer.links).toEqual({
      github: "https://github.com/anasouza",
      linkedin: "",
    });
    expect(developer.projects[0]?.links).toEqual({
      github: "",
      demo: "https://clinic.vercel.app/",
    });
  });
});

describe("experience and hiring types", () => {
  it("stay empty when the developer didn't answer them", () => {
    const developer = localProfileToDeveloper(emptyProfile, "ana");
    expect(developer.experience).toBe("");
  });

  it("reach Discover in the catalog's format, so its filters apply", () => {
    const developer = localProfileToDeveloper(
      { ...emptyProfile, experienceYears: 4, hiringTypes: ["PJ", "CLT"] },
      "ana",
    );
    expect(developer).toMatchObject({ experience: "4 anos", hiringTypes: ["PJ", "CLT"] });
    expect(experienceLabel(1)).toBe("1 ano");
    expect(experienceLabel(0)).toBe("0 anos");
  });
});

describe("missingProfileFields", () => {
  const complete = {
    ...emptyProfile,
    name: "Ana Souza",
    role: "Frontend Developer",
    location: "Recife, PE",
    seniority: "Pleno",
    workMode: "Remoto",
    availability: "Disponível agora",
    bio: "Desenvolvo interfaces acessíveis.",
  };

  it("lists blank required fields in form order", () => {
    expect(missingProfileFields({ ...emptyProfile, skills: [] })).toEqual([
      "name",
      "role",
      "location",
      "seniority",
      "workMode",
      "availability",
      "bio",
      "skills",
    ]);
  });

  it("treats whitespace as blank", () => {
    expect(missingProfileFields({ ...complete, name: "   " })).toEqual(["name"]);
  });

  it("accepts a profile without projects, links or experience", () => {
    expect(complete.projects).toEqual([]);
    expect(missingProfileFields(complete)).toEqual([]);
  });
});

describe("profileInputSchema", () => {
  const complete = {
    ...emptyProfile,
    name: " Ana Souza ",
    role: "Frontend Developer",
    location: "Recife, PE",
    seniority: "Pleno",
    workMode: "Remoto",
    availability: "Disponível agora",
    bio: "Desenvolvo interfaces acessíveis.",
    projects: [newProject({ name: "Clinic Booking", tech: ["Vue"] })],
  };

  it("accepts a complete profile, trimming its text", () => {
    expect(profileInputSchema.parse(complete).name).toBe("Ana Souza");
  });

  it("refuses blank required fields and options the filters don't know", () => {
    expect(profileInputSchema.safeParse({ ...complete, bio: " " }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...complete, skills: [] }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...complete, seniority: "Estagiário" }).success).toBe(
      false,
    );
    expect(profileInputSchema.safeParse({ ...complete, hiringTypes: ["Bolsa"] }).success).toBe(
      false,
    );
  });

  it("takes a location only as the form builds it, a city and its state", () => {
    expect(profileInputSchema.safeParse({ ...complete, location: "Recife" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...complete, location: "Recife, XX" }).success).toBe(
      false,
    );
  });

  it("only takes profile photos made by the form", () => {
    const withPhoto = (photo: string) => ({ ...complete, photo });
    expect(profileInputSchema.safeParse(withPhoto("")).success).toBe(true);
    expect(profileInputSchema.safeParse(withPhoto("data:image/jpeg;base64,AAAA")).success).toBe(
      true,
    );
    expect(profileInputSchema.safeParse(withPhoto("https://example.com/me.png")).success).toBe(
      false,
    );
    // URLs file storage gave earlier saves.
    expect(
      profileInputSchema.safeParse(
        withPhoto("https://abc123.public.blob.vercel-storage.com/photos/ana/1.jpg"),
      ).success,
    ).toBe(true);
    expect(profileInputSchema.safeParse(withPhoto("/uploads/photos/ana/1.jpg")).success).toBe(true);
    expect(
      profileInputSchema.safeParse(withPhoto("http://abc123.public.blob.vercel-storage.com/a.jpg"))
        .success,
    ).toBe(false);
  });

  it("only takes project covers made by the form", () => {
    const withCover = (image: string) => ({
      ...complete,
      projects: [newProject({ name: "Clinic Booking", image })],
    });
    expect(profileInputSchema.safeParse(withCover("data:image/jpeg;base64,AAAA")).success).toBe(
      true,
    );
    expect(profileInputSchema.safeParse(withCover("https://example.com/a.png")).success).toBe(
      false,
    );
  });
});
