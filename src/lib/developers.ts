import gabriel from "@/assets/developer-gabriel.jpg";
import marina from "@/assets/developer-marina.jpg";
import rafael from "@/assets/developer-rafael.jpg";
import juliana from "@/assets/developer-juliana.jpg";

type ProjectSeed = { name: string; description: string; tech: string[]; color: string };
export type Project = ProjectSeed & { links: { github: string; demo: string } };
export type ProfessionalLinks = { github: string; linkedin: string };
export type Developer = {
  id: string;
  name: string;
  role: string;
  seniority: string;
  location: string;
  hiringTypes: string[];
  workMode: string;
  availability: string;
  bio: string;
  skills: string[];
  experience: string;
  image: string;
  rate: number;
  projects: Project[];
  links: ProfessionalLinks;
};

const projectSets: ProjectSeed[][] = [
  [
    {
      name: "Pulse Commerce",
      description: "Checkout modular que reduziu o abandono em 24%.",
      tech: ["Next.js", "Node.js"],
      color: "project-blue",
    },
    {
      name: "Atlas CRM",
      description: "Plataforma comercial com automações e analytics.",
      tech: ["React", "NestJS"],
      color: "project-green",
    },
    {
      name: "Core Banking",
      description: "APIs resilientes para operações financeiras.",
      tech: ["C#", "PostgreSQL"],
      color: "project-ink",
    },
  ],
  [
    {
      name: "Nexo Design System",
      description: "Biblioteca acessível usada por 12 squads.",
      tech: ["React", "Storybook"],
      color: "project-violet",
    },
    {
      name: "Data Lens",
      description: "Dashboard de métricas em tempo real.",
      tech: ["Next.js", "GraphQL"],
      color: "project-blue",
    },
    {
      name: "Health Flow",
      description: "Experiência de agendamento para clínicas.",
      tech: ["TypeScript", "Tailwind"],
      color: "project-green",
    },
  ],
  [
    {
      name: "Ledger API",
      description: "Serviços de conciliação com alta disponibilidade.",
      tech: ["Java", "AWS"],
      color: "project-ink",
    },
    {
      name: "ShipFast",
      description: "Motor logístico para entregas nacionais.",
      tech: ["Node.js", "MongoDB"],
      color: "project-blue",
    },
    {
      name: "Observa",
      description: "Monitoramento distribuído para microsserviços.",
      tech: ["Docker", "Python"],
      color: "project-violet",
    },
  ],
  [
    {
      name: "Cloud Guard",
      description: "Governança multi-cloud e controle de custos.",
      tech: ["AWS", "Python"],
      color: "project-blue",
    },
    {
      name: "Deploy Hub",
      description: "Portal interno para deploys autônomos.",
      tech: ["Docker", "Terraform"],
      color: "project-green",
    },
    {
      name: "Event Grid",
      description: "Pipeline orientado a eventos em grande escala.",
      tech: ["Python", "MongoDB"],
      color: "project-violet",
    },
  ],
];

projectSets.push(
  [
    {
      name: "Rota Mobile",
      description: "Aplicativo de rotas com autenticação e favoritos.",
      tech: ["React Native", "Firebase"],
      color: "project-blue",
    },
    {
      name: "Habit Pocket",
      description: "Registro de hábitos com sincronização entre dispositivos.",
      tech: ["TypeScript", "Firebase"],
      color: "project-green",
    },
  ],
  [
    {
      name: "Order Bridge",
      description: "Integração de pedidos entre sistemas corporativos.",
      tech: ["C#", ".NET", "SQL Server"],
      color: "project-ink",
    },
    {
      name: "Azure Desk",
      description: "Portal de atendimento com APIs hospedadas em Azure.",
      tech: ["React", "Azure"],
      color: "project-blue",
    },
  ],
  [
    {
      name: "Lake Pipeline",
      description: "Ingestão e transformação de dados com execução agendada.",
      tech: ["Python", "AWS", "Airflow"],
      color: "project-blue",
    },
    {
      name: "Quality Watch",
      description: "Validação de qualidade em tabelas analíticas.",
      tech: ["Python", "PostgreSQL"],
      color: "project-green",
    },
  ],
  [
    {
      name: "Study Board",
      description: "Organizador de estudos com tarefas e progresso.",
      tech: ["Vue", "TypeScript"],
      color: "project-violet",
    },
    {
      name: "Local Catalog",
      description: "Catálogo de produtos com cadastro e busca.",
      tech: ["Node.js", "MongoDB"],
      color: "project-green",
    },
  ],
);

const bios = [
  "Desenvolvo aplicações full stack com React e Node.js, integrando interfaces, APIs e bancos relacionais.",
  "Sou especialista em interfaces React, acessibilidade e design systems. Colaboro com produto e design para evoluir experiências web.",
  "Projeto APIs e serviços backend com Java e Node.js, com foco em observabilidade, integração e confiabilidade.",
  "Automatizo infraestrutura em AWS com Terraform e Python e mantenho pipelines de deploy para aplicações em containers.",
  "Crio aplicativos em React Native com TypeScript, integrando autenticação, notificações e sincronização com Firebase.",
  "Desenvolvo sistemas corporativos em C# e .NET, modernizando APIs e integrações com Azure e SQL Server.",
  "Construo pipelines de dados com Python e Airflow, organizando ingestão, transformação e qualidade de dados em AWS.",
  "Estou consolidando minha experiência com Vue e Node.js em aplicações de pequeno porte, com revisão de código e colaboração do time.",
];

const base = [
  [
    "gabriel-botelho",
    "Gabriel Botelho",
    "Full Stack Developer",
    "Pleno",
    "Uberaba, MG",
    "Remoto",
    "Disponível agora",
    ["React", "Next.js", "Node.js", "NestJS", "C#", "PostgreSQL"],
    "5 anos",
    gabriel,
    120,
    ["Freelancer", "PJ"],
  ],
  [
    "marina-costa",
    "Marina Costa",
    "Frontend Developer",
    "Sênior",
    "São Paulo, SP",
    "Remoto",
    "Disponível agora",
    ["React", "Next.js", "TypeScript", "Tailwind", "GraphQL"],
    "8 anos",
    marina,
    180,
    ["Contrato", "PJ"],
  ],
  [
    "rafael-lima",
    "Rafael Lima",
    "Backend Engineer",
    "Sênior",
    "Salvador, BA",
    "Híbrido",
    "Em 15 dias",
    ["Java", "Node.js", "AWS", "PostgreSQL", "Docker"],
    "9 anos",
    rafael,
    190,
    ["CLT", "PJ"],
  ],
  [
    "juliana-tanaka",
    "Juliana Tanaka",
    "Cloud Engineer",
    "Pleno",
    "Curitiba, PR",
    "Remoto",
    "Disponível agora",
    ["AWS", "Python", "Docker", "Terraform", "MongoDB"],
    "6 anos",
    juliana,
    155,
    ["Freelancer", "Contrato"],
  ],
  [
    "lucas-mendes",
    "Lucas Mendes",
    "Mobile Developer",
    "Pleno",
    "Recife, PE",
    "Remoto",
    "Em 30 dias",
    ["React Native", "TypeScript", "Node.js", "Firebase"],
    "5 anos",
    gabriel,
    130,
    ["Freelancer", "PJ"],
  ],
  [
    "amanda-rocha",
    "Amanda Rocha",
    ".NET Developer",
    "Sênior",
    "Belo Horizonte, MG",
    "Híbrido",
    "Em 15 dias",
    ["C#", ".NET", "Azure", "SQL Server", "React"],
    "10 anos",
    marina,
    195,
    ["CLT", "Contrato"],
  ],
  [
    "diego-santos",
    "Diego Santos",
    "Data Engineer",
    "Pleno",
    "Rio de Janeiro, RJ",
    "Presencial",
    "Disponível agora",
    ["Python", "AWS", "PostgreSQL", "Docker", "Airflow"],
    "6 anos",
    rafael,
    145,
    ["CLT"],
  ],
  [
    "beatriz-alves",
    "Beatriz Alves",
    "Full Stack Developer",
    "Júnior",
    "Florianópolis, SC",
    "Remoto",
    "Em 15 dias",
    ["Vue", "Node.js", "MongoDB", "TypeScript"],
    "2 anos",
    juliana,
    85,
    ["Freelancer", "CLT"],
  ],
] as const;

export const developers: Developer[] = base.map((d, index) => ({
  id: d[0],
  name: d[1],
  role: d[2],
  seniority: d[3],
  location: d[4],
  workMode: d[5],
  availability: d[6],
  skills: [...d[7]],
  experience: d[8],
  image: d[9],
  rate: d[10],
  hiringTypes: [...d[11]],
  bio: bios[index] ?? "",
  // Example addresses for fictional people; the profile page shows them without navigating.
  links: {
    github: `https://github.com/${d[0]}`,
    linkedin: `https://www.linkedin.com/in/${d[0]}`,
  },
  projects: (projectSets[index] ?? []).map((project) => {
    const slug = slugify(project.name);
    return {
      ...project,
      links: {
        github: `https://github.com/${d[0]}/${slug}`,
        demo: `https://${slug}.vercel.app`,
      },
    };
  }),
}));

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
