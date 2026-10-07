/**
 * What the end-to-end tests find in the database besides the seed (teste.dev with Gabriel's
 * profile, and teste.emp): four more developers and three companies that reached Gabriel. The
 * fixtures put it back before every test, through /api/test-seed.
 */

export const developer = (fields: {
  id: string;
  name: string;
  role: string;
  location: string;
  seniority: string;
  workMode: string;
  availability: string;
  skills: string[];
  hiringTypes: string[];
  experienceYears: number;
  rate: number;
  project: string;
}) => ({
  id: fields.id,
  email: `${fields.id}@example.com`,
  profile: {
    name: fields.name,
    role: fields.role,
    location: fields.location,
    seniority: fields.seniority,
    workMode: fields.workMode,
    availability: fields.availability,
    bio: `${fields.name} trabalha com ${fields.skills.join(" e ")}.`,
    photo: "",
    github: `https://github.com/${fields.id}`,
    linkedin: "",
    website: "",
    skills: fields.skills,
    experienceYears: fields.experienceYears,
    rate: fields.rate,
    hiringTypes: fields.hiringTypes,
    projects: [
      {
        id: `${fields.id}-project`,
        name: fields.project,
        description: `Projeto de ${fields.name}.`,
        tech: fields.skills,
        image: "",
        github: "",
        demo: "",
      },
    ],
  },
});

// After Gabriel, Discover lists them in this order. Two are Sênior, only Diego is Presencial, and
// no one does Angular on site.
export const testDevelopers = [
  developer({
    id: "marina-costa",
    name: "Marina Costa",
    role: "Frontend Developer",
    location: "São Paulo, SP",
    seniority: "Sênior",
    workMode: "Remoto",
    availability: "Disponível agora",
    skills: ["React", "TypeScript"],
    hiringTypes: ["CLT", "PJ"],
    experienceYears: 8,
    rate: 150,
    project: "Nexo Design System",
  }),
  developer({
    id: "rafael-lima",
    name: "Rafael Lima",
    role: "Backend Developer",
    location: "Belo Horizonte, MG",
    seniority: "Sênior",
    workMode: "Híbrido",
    availability: "Em 15 dias",
    skills: ["Node.js", "PostgreSQL"],
    hiringTypes: ["PJ"],
    experienceYears: 7,
    rate: 140,
    project: "Ledger API",
  }),
  developer({
    id: "diego-santos",
    name: "Diego Santos",
    role: "Java Developer",
    location: "Curitiba, PR",
    seniority: "Pleno",
    workMode: "Presencial",
    availability: "Em 30 dias",
    skills: ["Java", "Spring Boot"],
    hiringTypes: ["CLT"],
    experienceYears: 4,
    rate: 90,
    project: "Gov Connect",
  }),
  developer({
    id: "larissa-souza",
    name: "Larissa Souza",
    role: "Frontend Developer",
    location: "Recife, PE",
    seniority: "Júnior",
    workMode: "Remoto",
    availability: "Disponível agora",
    skills: ["Angular", "TypeScript"],
    hiringTypes: ["Freelancer"],
    experienceYears: 1,
    rate: 60,
    project: "Painel Fiscal",
  }),
];

export const testCompanies = [
  {
    id: "demo-company-nuvempay",
    email: "contato@nuvempay.example",
    company: "NuvemPay",
    settings: {
      website: "nuvempay.example",
      location: "São Paulo, SP",
      about:
        "Fintech de pagamentos digitais para pequenos e médios negócios. Nosso time de tecnologia tem 40 pessoas, divididas entre produto, plataforma e dados.",
      contactName: "Carla Mendes",
      contactRole: "Tech Recruiter",
      contactEmail: "carla.mendes@nuvempay.example",
      phone: "",
    },
    interestIn: ["demo-developer"],
  },
  {
    id: "demo-company-orbita",
    email: "contato@orbitalabs.example",
    company: "Órbita Labs",
    settings: {
      website: "orbitalabs.example",
      location: "Florianópolis, SC",
      about:
        "Estúdio de produto que cria aplicativos web e mobile para startups de saúde e educação.",
      contactName: "Thiago Rocha",
      contactRole: "CTO",
      contactEmail: "thiago@orbitalabs.example",
      phone: "",
    },
    interestIn: ["demo-developer"],
  },
  {
    id: "demo-company-verdetech",
    email: "contato@verdetech.example",
    company: "VerdeTech",
    settings: {
      website: "verdetech.example",
      location: "Campinas, SP",
      about:
        "Plataforma de gestão para o agronegócio, com monitoramento de lavouras e logística em tempo real.",
      contactName: "Paula Nogueira",
      contactRole: "Head de Engenharia",
      contactEmail: "paula@verdetech.example",
      phone: "(19) 3555-0142",
    },
    interestIn: [],
    meetings: [
      {
        developerId: "demo-developer",
        // Far enough ahead to stay a future proposal.
        date: "2030-10-08",
        time: "14:00",
        message:
          "Olá! Gostamos muito dos seus projetos e queremos conversar sobre uma vaga de Full Stack no nosso time de produto.",
      },
    ],
  },
];
