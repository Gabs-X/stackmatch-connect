import gabriel from "@/assets/developer-gabriel.jpg";
import marina from "@/assets/developer-marina.jpg";
import rafael from "@/assets/developer-rafael.jpg";
import juliana from "@/assets/developer-juliana.jpg";

export type Project = { name: string; description: string; tech: string[]; color: string };
export type Developer = {
  id: string; name: string; role: string; seniority: string; location: string;
  workMode: string; availability: string; bio: string; skills: string[];
  experience: string; image: string; rate: number; projects: Project[];
};

const projectSets: Project[][] = [
  [
    { name: "Pulse Commerce", description: "Checkout modular que reduziu o abandono em 24%.", tech: ["Next.js", "Node.js"], color: "project-blue" },
    { name: "Atlas CRM", description: "Plataforma comercial com automações e analytics.", tech: ["React", "NestJS"], color: "project-green" },
    { name: "Core Banking", description: "APIs resilientes para operações financeiras.", tech: ["C#", "PostgreSQL"], color: "project-ink" },
  ],
  [
    { name: "Nexo Design System", description: "Biblioteca acessível usada por 12 squads.", tech: ["React", "Storybook"], color: "project-violet" },
    { name: "Data Lens", description: "Dashboard de métricas em tempo real.", tech: ["Next.js", "GraphQL"], color: "project-blue" },
    { name: "Health Flow", description: "Experiência de agendamento para clínicas.", tech: ["TypeScript", "Tailwind"], color: "project-green" },
  ],
  [
    { name: "Ledger API", description: "Serviços de conciliação com alta disponibilidade.", tech: ["Java", "AWS"], color: "project-ink" },
    { name: "ShipFast", description: "Motor logístico para entregas nacionais.", tech: ["Node.js", "MongoDB"], color: "project-blue" },
    { name: "Observa", description: "Monitoramento distribuído para microsserviços.", tech: ["Docker", "Python"], color: "project-violet" },
  ],
  [
    { name: "Cloud Guard", description: "Governança multi-cloud e controle de custos.", tech: ["AWS", "Python"], color: "project-blue" },
    { name: "Deploy Hub", description: "Portal interno para deploys autônomos.", tech: ["Docker", "React"], color: "project-green" },
    { name: "Event Grid", description: "Pipeline orientado a eventos em grande escala.", tech: ["NestJS", "PostgreSQL"], color: "project-violet" },
  ],
];

const base = [
  ["gabriel-botelho", "Gabriel Botelho", "Full Stack Developer", "Pleno", "Uberaba, MG", "Remoto", "Disponível agora", ["React", "Next.js", "Node.js", "NestJS", "C#", "PostgreSQL"], "5 anos", gabriel, 120],
  ["marina-costa", "Marina Costa", "Frontend Developer", "Sênior", "São Paulo, SP", "Remoto", "Disponível agora", ["React", "Next.js", "TypeScript", "Tailwind", "GraphQL"], "8 anos", marina, 180],
  ["rafael-lima", "Rafael Lima", "Backend Engineer", "Sênior", "Salvador, BA", "Híbrido", "Em 15 dias", ["Java", "Node.js", "AWS", "PostgreSQL", "Docker"], "9 anos", rafael, 190],
  ["juliana-tanaka", "Juliana Tanaka", "Cloud Engineer", "Pleno", "Curitiba, PR", "Remoto", "Disponível agora", ["AWS", "Python", "Docker", "Terraform", "MongoDB"], "6 anos", juliana, 155],
  ["lucas-mendes", "Lucas Mendes", "Mobile Developer", "Pleno", "Recife, PE", "Remoto", "Em 30 dias", ["React Native", "TypeScript", "Node.js", "Firebase"], "5 anos", gabriel, 130],
  ["amanda-rocha", "Amanda Rocha", ".NET Developer", "Sênior", "Belo Horizonte, MG", "Híbrido", "Em 15 dias", ["C#", ".NET", "Azure", "SQL Server", "React"], "10 anos", marina, 195],
  ["diego-santos", "Diego Santos", "Data Engineer", "Pleno", "Rio de Janeiro, RJ", "Presencial", "Disponível agora", ["Python", "AWS", "PostgreSQL", "Docker", "Airflow"], "6 anos", rafael, 145],
  ["beatriz-alves", "Beatriz Alves", "Full Stack Developer", "Júnior", "Florianópolis, SC", "Remoto", "Em 15 dias", ["Vue", "Node.js", "MongoDB", "TypeScript"], "2 anos", juliana, 85],
] as const;

export const developers: Developer[] = base.map((d, index) => ({
  id: d[0], name: d[1], role: d[2], seniority: d[3], location: d[4], workMode: d[5],
  availability: d[6], skills: [...d[7]], experience: d[8], image: d[9], rate: d[10],
  bio: "Transformo desafios de produto em experiências digitais simples, confiáveis e orientadas a resultados. Gosto de trabalhar próximo ao negócio e colaborar com times multidisciplinares.",
  projects: projectSets[index % projectSets.length],
}));