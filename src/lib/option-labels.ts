import type { Lang } from "./i18n";

/**
 * A value stored in Portuguese ("Remoto", "4 anos") in the language; also for text built outside
 * React, such as e-mails.
 */
export function optionLabel(value: string, lang: Lang) {
  if (lang === "pt") return value;
  const years = value.match(/^(\d+) anos?$/);
  if (years) return years[1] === "1" ? "1 year" : `${years[1]} years`;
  return dataEn[value] ?? value;
}

// English for values stored in Portuguese: the profile options, the seed profile's texts and the
// example card on the home page.
const dataEn: Record<string, string> = {
  "Crio interfaces em React e TypeScript com foco em acessibilidade e design systems.":
    "I build React and TypeScript interfaces with a focus on accessibility and design systems.",
  "Desenvolvo aplicações full stack com React e Node.js, integrando interfaces, APIs e bancos relacionais.":
    "I build full stack applications with React and Node.js, connecting interfaces, APIs and relational databases.",
  Júnior: "Junior",
  Pleno: "Mid-level",
  Sênior: "Senior",
  Remoto: "Remote",
  Híbrido: "Hybrid",
  Presencial: "On-site",
  "Disponível agora": "Available now",
  "Em 15 dias": "In 15 days",
  "Em 30 dias": "In 30 days",
  Contrato: "Contract",
  "Checkout modular que reduziu o abandono em 24%.":
    "Modular checkout that cut cart abandonment by 24%.",
  "Plataforma comercial com automações e analytics.":
    "Sales platform with automations and analytics.",
  "APIs resilientes para operações financeiras.": "Resilient APIs for financial operations.",
};
