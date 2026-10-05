import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

export const brazilStates = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
] as const;

const citiesSchema = z.array(z.object({ id: z.number().int(), nome: z.string().min(1) })).min(1);

/** "Recife, PE" -> { city: "Recife", uf: "PE" }; anything else keeps the text as the city and no state. */
export function parseLocation(value: string) {
  const comma = value.lastIndexOf(",");
  const uf = value
    .slice(comma + 1)
    .trim()
    .toUpperCase();
  return comma >= 0 && brazilStates.some(([code]) => code === uf)
    ? { city: value.slice(0, comma).trim(), uf }
    : { city: value, uf: "" };
}

/** A location the form builds: a city and a valid state, as "Recife, PE". */
export function isLocation(value: string) {
  const { city, uf } = parseLocation(value);
  return Boolean(uf && city);
}

/**
 * IBGE's cities of a state, by name. The query key separates each state's list, including
 * requests still in flight.
 */
export const citiesQuery = (uf: string) =>
  queryOptions({
    queryKey: ["ibge-cities", uf],
    queryFn: async ({ signal }) => {
      if (!brazilStates.some(([code]) => code === uf)) throw new Error("Invalid state");
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
        { signal },
      );
      if (!response.ok) throw new Error("Could not load cities");
      return citiesSchema.parse(await response.json());
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
