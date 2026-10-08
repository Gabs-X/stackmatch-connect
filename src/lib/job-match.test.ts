import { describe, expect, it } from "vitest";
import { locationMet, matchJob } from "./job-match";
import { emptyJob, type JobInput } from "./jobs";

const marina = {
  skills: ["React", "TypeScript", "GraphQL"],
  seniority: "Sênior",
  workMode: "Remoto",
  hiringTypes: ["CLT", "PJ"],
  availability: "Disponível agora",
  location: "São Paulo, SP",
};

const job: JobInput = {
  ...emptyJob,
  title: "Front-end",
  requiredSkills: ["react", "TypeScript"],
  desiredSkills: ["GraphQL", "Next.js"],
  seniority: ["Sênior"],
  workModes: ["Remoto", "Híbrido"],
  hiringTypes: ["PJ"],
  availability: ["Disponível agora"],
};

describe("matchJob", () => {
  it("weighs each criterion the job sets and lists the skills met and missing", () => {
    const match = matchJob(job, marina);
    // All but half of the nice-to-have skills: (40 + 7.5 + 15 + 10 + 10 + 5) / 95.
    expect(match.score).toBe(92);
    expect(match.criteria.find((c) => c.criterion === "desiredSkills")).toMatchObject({
      met: 0.5,
      matched: ["GraphQL"],
      missing: ["Next.js"],
    });
    // Skill names match whatever the case.
    expect(match.criteria.find((c) => c.criterion === "requiredSkills")?.met).toBe(1);
  });

  it("leaves out what the job doesn't ask for", () => {
    const match = matchJob({ ...emptyJob, title: "Qualquer", seniority: ["Júnior"] }, marina);
    expect(match.criteria.map((c) => c.criterion)).toEqual(["seniority"]);
    expect(match.score).toBe(0);
    expect(matchJob({ ...emptyJob, title: "Nada" }, marina)).toEqual({ score: null, criteria: [] });
  });

  it("only weighs the city when the job isn't remote only", () => {
    const remote = matchJob({ ...job, location: "Recife, PE", workModes: ["Remoto"] }, marina);
    expect(remote.criteria.some((c) => c.criterion === "location")).toBe(false);
    const hybrid = matchJob({ ...job, location: "Campinas, SP" }, marina);
    expect(hybrid.criteria.find((c) => c.criterion === "location")?.met).toBe(0.5);
  });
});

describe("locationMet", () => {
  it("is full in the same city, half in the same state and none elsewhere", () => {
    expect(locationMet("São Paulo, SP", "são paulo, SP")).toBe(1);
    expect(locationMet("Campinas, SP", "São Paulo, SP")).toBe(0.5);
    expect(locationMet("Recife, PE", "São Paulo, SP")).toBe(0);
  });
});
