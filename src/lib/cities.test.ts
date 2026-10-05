import { describe, expect, it } from "vitest";
import { isLocation, parseLocation } from "./cities";

describe("parseLocation", () => {
  it("splits the city from a known state at the last comma", () => {
    expect(parseLocation("Recife, PE")).toEqual({ city: "Recife", uf: "PE" });
    expect(parseLocation("Embu das Artes, sp")).toEqual({ city: "Embu das Artes", uf: "SP" });
  });

  it("keeps older free text as the city, with no state", () => {
    expect(parseLocation("Remoto")).toEqual({ city: "Remoto", uf: "" });
    expect(parseLocation("Lisboa, PT")).toEqual({ city: "Lisboa, PT", uf: "" });
    expect(parseLocation("")).toEqual({ city: "", uf: "" });
  });
});

describe("isLocation", () => {
  it("needs a city and a valid state", () => {
    expect(isLocation("Uberaba, MG")).toBe(true);
    expect(isLocation(", MG")).toBe(false);
    expect(isLocation("Uberaba")).toBe(false);
    expect(isLocation("Uberaba, XX")).toBe(false);
  });
});
