import { describe, expect, it } from "vitest";
import type { Developer } from "./developers";
import { defaultFilters, matchesFilters, type Filters } from "./filters";

const developer = (overrides: Partial<Developer> = {}): Developer => ({
  id: "dev",
  name: "Dev",
  role: "Frontend Developer",
  seniority: "Pleno",
  location: "Recife, PE",
  hiringTypes: ["PJ"],
  workMode: "Remoto",
  availability: "Disponível agora",
  bio: "",
  skills: ["React", "TypeScript"],
  experience: "5 anos",
  image: "",
  rate: 150,
  projects: [],
  links: { github: "", linkedin: "" },
  ...overrides,
});

const filters = (overrides: Partial<Filters>): Filters => ({ ...defaultFilters, ...overrides });

describe("matchesFilters", () => {
  it("accepts every profile with the default filters", () => {
    expect(matchesFilters(developer(), defaultFilters)).toBe(true);
  });

  it("combines options of the same group with OR", () => {
    const vueDev = developer({ skills: ["Vue"] });
    expect(matchesFilters(vueDev, filters({ skills: ["React", "Vue"] }))).toBe(true);
    expect(matchesFilters(vueDev, filters({ skills: ["React", "Java"] }))).toBe(false);
  });

  it("combines different groups with AND", () => {
    const seniorReact = filters({ skills: ["React"], seniority: ["Sênior"] });
    expect(matchesFilters(developer({ seniority: "Sênior" }), seniorReact)).toBe(true);
    expect(matchesFilters(developer({ seniority: "Pleno" }), seniorReact)).toBe(false);
  });

  it("matches hiring types, work mode and availability", () => {
    const dev = developer({ hiringTypes: ["CLT", "PJ"] });
    expect(matchesFilters(dev, filters({ hiring: ["CLT"] }))).toBe(true);
    expect(matchesFilters(dev, filters({ hiring: ["Freelancer"] }))).toBe(false);
    expect(matchesFilters(dev, filters({ mode: ["Híbrido"] }))).toBe(false);
    expect(matchesFilters(dev, filters({ availability: ["Em 30 dias"] }))).toBe(false);
  });

  it("includes the rate equal to the maximum and excludes higher rates", () => {
    expect(matchesFilters(developer({ rate: 150 }), filters({ rate: [150] }))).toBe(true);
    expect(matchesFilters(developer({ rate: 160 }), filters({ rate: [150] }))).toBe(false);
  });

  it("shows profiles without a rate only while the rate filter is untouched", () => {
    const noRate = developer({ rate: Number.NaN });
    expect(matchesFilters(noRate, defaultFilters)).toBe(true);
    expect(matchesFilters(noRate, filters({ rate: [200] }))).toBe(false);
  });

  it("excludes a profile with an empty field when that group is filtered", () => {
    const noWorkMode = developer({ workMode: "" });
    expect(matchesFilters(noWorkMode, defaultFilters)).toBe(true);
    expect(matchesFilters(noWorkMode, filters({ mode: ["Remoto"] }))).toBe(false);
  });
});
