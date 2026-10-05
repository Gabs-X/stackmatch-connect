import gabriel from "@/assets/developer-gabriel.jpg";
import marina from "@/assets/developer-marina.jpg";
import rafael from "@/assets/developer-rafael.jpg";
import juliana from "@/assets/developer-juliana.jpg";
import type { CompanyProfile } from "./company-settings";
import type { LocalProfile } from "./local-profile";

// Catalog values double as filter keys; tv() translates them for display.
export const seniorityOptions = ["Júnior", "Pleno", "Sênior"] as const;
export const workModeOptions = ["Remoto", "Híbrido", "Presencial"] as const;
export const hiringOptions = ["Freelancer", "Contrato", "CLT", "PJ"] as const;
export const availabilityOptions = ["Disponível agora", "Em 15 dias", "Em 30 dias"] as const;

type ProjectSeed = { name: string; description: string; tech: string[]; color: string };
export type Project = ProjectSeed & { links: { github: string; demo: string }; image?: string };
export type ProfessionalLinks = {
  github: string;
  linkedin: string;
  website?: string;
  /** Real addresses that open on click; without it they are examples for fictional people. */
  verified?: true;
};

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
  /** Created by a developer account in the app, not the fictional catalog; `id` is the account id. */
  isLocal?: true;
};

const projectSets: ProjectSeed[][] = [
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

/**
 * Public avatar of the GitHub account in profileUrl, always the owner's current photo.
 * Returns undefined for non-GitHub or malformed addresses.
 */
export function githubAvatarUrl(profileUrl: string, size = 768): string | undefined {
  try {
    const url = new URL(profileUrl);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return undefined;
    const user = url.pathname.split("/").find(Boolean);
    // GitHub usernames: letters, digits and hyphens, up to 39 characters.
    return user && /^[a-z\d][a-z\d-]{0,38}$/i.test(user)
      ? `https://github.com/${user}.png?size=${size}`
      : undefined;
  } catch {
    return undefined;
  }
}

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
  // Example addresses for fictional people, shown without navigating.
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

/**
 * Profile of the demo developer account (teste.dev): Gabriel Botelho, with his real links. It
 * stands in for the profile that account saved in the browser until it saves its own edits.
 */
export const demoDeveloperProfile: LocalProfile = {
  name: "Gabriel Botelho",
  role: "Full Stack Developer",
  location: "Uberaba, MG",
  seniority: "Pleno",
  availability: "Disponível agora",
  workMode: "Remoto",
  bio: "Desenvolvo aplicações full stack com React e Node.js, integrando interfaces, APIs e bancos relacionais.",
  github: "https://github.com/Gabs-X",
  linkedin: "https://www.linkedin.com/in/gabriel-anthony-7688bb224/",
  website: "https://gabrielanthony.vercel.app",
  skills: ["React", "Next.js", "Node.js", "NestJS", "C#", "PostgreSQL"],
  experienceYears: 5,
  rate: 120,
  hiringTypes: ["Freelancer", "PJ"],
  // No example repository or demo addresses: this profile's links open for real.
  projects: [
    {
      id: "demo-pulse-commerce",
      name: "Pulse Commerce",
      description: "Checkout modular que reduziu o abandono em 24%.",
      tech: ["Next.js", "Node.js"],
      image: "",
      github: "",
      demo: "",
    },
    {
      id: "demo-atlas-crm",
      name: "Atlas CRM",
      description: "Plataforma comercial com automações e analytics.",
      tech: ["React", "NestJS"],
      image: "",
      github: "",
      demo: "",
    },
    {
      id: "demo-core-banking",
      name: "Core Banking",
      description: "APIs resilientes para operações financeiras.",
      tech: ["C#", "PostgreSQL"],
      image: "",
      github: "",
      demo: "",
    },
  ],
};
/**
 * Companies that showed interest in the demo developer account (teste.dev), so its "Interested
 * companies" page has something to show. Dates are relative to `now` to always look recent.
 */
export function demoCompanyActivity(developerId: string, developerName: string, now = Date.now()) {
  const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const proposedDay = new Date(now + 3 * 86_400_000).toISOString().slice(0, 10);
  return {
    interests: [
      {
        id: "demo-interest-nuvempay",
        companyId: "demo-company-nuvempay",
        developerId,
        company: "NuvemPay",
        contactName: "Carla Mendes",
        email: "carla.mendes@nuvempay.example",
        at: hoursAgo(5),
      },
      {
        id: "demo-interest-orbita",
        companyId: "demo-company-orbita",
        developerId,
        company: "Órbita Labs",
        contactName: "Thiago Rocha",
        email: "thiago@orbitalabs.example",
        at: hoursAgo(30),
      },
    ],
    meetings: [
      {
        id: "demo-meeting-verdetech",
        companyId: "demo-company-verdetech",
        developerId,
        developerName,
        date: proposedDay,
        time: "14:00",
        company: "VerdeTech",
        contactName: "Paula Nogueira",
        email: "paula@verdetech.example",
        message:
          "Olá! Gostamos muito dos seus projetos e queremos conversar sobre uma vaga de Full Stack no nosso time de produto.",
        sentAt: hoursAgo(2),
      },
    ],
  };
}

/** Public details of the companies in the demo activity, keyed by company account id. */
export const demoCompanyProfiles: Record<string, CompanyProfile> = {
  "demo-company-nuvempay": {
    about:
      "Fintech de pagamentos digitais para pequenos e médios negócios. Nosso time de tecnologia tem 40 pessoas, divididas entre produto, plataforma e dados.",
    website: "nuvempay.example",
    location: "São Paulo, SP",
    contactRole: "Tech Recruiter",
    phone: "",
    demo: true,
  },
  "demo-company-orbita": {
    about:
      "Estúdio de produto que cria aplicativos web e mobile para startups de saúde e educação. Time enxuto, 100% remoto e com bastante autonomia.",
    website: "orbitalabs.example",
    location: "Florianópolis, SC",
    contactRole: "CTO",
    phone: "",
    demo: true,
  },
  "demo-company-verdetech": {
    about:
      "Plataforma de gestão para o agronegócio, com monitoramento de lavouras e logística em tempo real. Estamos ampliando o time de produto.",
    website: "verdetech.example",
    location: "Campinas, SP",
    contactRole: "Head de Engenharia",
    phone: "(19) 3555-0142",
    demo: true,
  },
};
