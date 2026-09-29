import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "pt" | "en";

const pt = {
  nav: { discover: "Discover", saved: "Talentos salvos", create: "Criar perfil", openMenu: "Abrir menu", language: "Idioma" },
  card: { photoOf: "Foto de", viewProfile: "Ver perfil" },
  filters: { title: "Filtros", subtitle: "Refine sua busca", clear: "Limpar", tech: "Tecnologias", seniority: "Senioridade", location: "Localização", maxRate: "Valor máximo/h", hiring: "Contratação" },
  home: {
    eyebrow: "Mais de 2.400 talentos verificados", h1a: "Encontre o desenvolvedor certo para o seu ", h1b: "próximo projeto.",
    sub: "Descubra profissionais com as tecnologias, experiência e disponibilidade que sua empresa precisa.",
    find: "Encontrar talentos", createMine: "Criar meu perfil", perks: ["Sem cadastro", "Perfis verificados", "Resposta rápida"],
    match: "Match com sua vaga", availableNow: "Disponível agora",
    howKicker: "Como funciona", howTitle: "Do briefing ao match em três passos.",
    steps: [
      { title: "Defina o que procura", description: "Escolha stack, senioridade, modelo de trabalho e faixa de valor." },
      { title: "Descubra profissionais", description: "Explore perfis completos e projetos relevantes para sua vaga." },
      { title: "Salve seus favoritos", description: "Monte uma shortlist e avance com os melhores talentos." },
    ],
    benefitsKicker: "Feito para decidir melhor", benefitsTitleA: "Menos currículos.", benefitsTitleB: "Mais contexto.",
    benefitsSub: "Veja o que realmente importa antes da primeira conversa.",
    benefits: ["Busca mais rápida", "Filtros inteligentes", "Análise por projetos", "Disponibilidade visível"],
    benefitText: "Informações objetivas para comparar talentos com confiança.",
    ctaTitle: "Seu próximo talento está a um match de distância.", ctaSub: "Comece agora e descubra profissionais prontos para transformar seu projeto.", ctaBtn: "Explorar talentos",
  },
  discover: {
    kicker: "Descoberta inteligente", title: "Encontre seu próximo talento", sub: "Perfis selecionados com base nas suas preferências.",
    filtersA11y: "Filtros de talentos", of: "de", profiles: "perfis", none: "Nenhum perfil", explored: "explorado",
    emptyTitle: "Nenhum talento encontrado", emptySub: "Tente remover alguns filtros para ampliar a busca.", clearFilters: "Limpar filtros",
    interested: "Interessado", pass: "Passar", save: "Salvar", stampYes: "INTERESSADO", stampNo: "PASSAR",
    toastPass: "Perfil ignorado", toastSave: "Talento salvo na sua lista", toastInterest: "Interesse registrado",
    compat: "Compatibilidade", great: "Excelente match", reasons: ["Stack compatível", "Experiência ideal", "Disponibilidade imediata"], fullProfile: "Ver perfil completo",
  },
  saved: { kicker: "Sua shortlist", title: "Talentos salvos", sub: "Compare os perfis que mais combinam com seu projeto.", remove: "Remover", emptyTitle: "Você ainda não salvou nenhum talento.", emptySub: "Use o Discover para montar sua shortlist." },
  profile: {
    back: "Voltar ao Discover", saved: "Salvo", save: "Salvar", toastRemoved: "Removido dos salvos", toastSaved: "Talento salvo",
    about: "Sobre mim", skills: "Skills", experience: "Experiência", expCompany: "Produto digital", expText: "Liderança técnica, arquitetura de aplicações e entrega contínua de experiências de alta qualidade.",
    portfolio: "Portfólio", featured: "Projetos em destaque", availability: "Disponibilidade", rate: "Valor por hora", links: "Links profissionais", portfolioLink: "Portfólio",
  },
  create: {
    steps: ["Informações pessoais", "Skills", "Projetos", "Links"], backEdit: "Voltar à edição", yourName: "Seu nome", yourRole: "Seu cargo profissional",
    yourBio: "Sua biografia aparecerá aqui. Conte sobre sua experiência, seu jeito de trabalhar e os problemas que você gosta de resolver.",
    projects: "Projetos", imported: "Projeto importado para seu portfólio.", addProjectsHint: "Adicione projetos para completar sua prévia.",
    kicker: "Seu mini portfólio", title: "Crie um perfil que se destaca", sub: "Leva apenas alguns minutos para ficar pronto.", preview: "Visualizar perfil",
    stepOf: (s: number) => `ETAPA ${s} DE 4`,
    fullName: "Nome completo", fullNamePh: "Como você quer ser encontrado?", role: "Cargo", rolePh: "Ex: Frontend Developer", location: "Localização", locationPh: "Cidade, estado",
    seniority: "Senioridade", seniorityPh: "Júnior, Pleno ou Sênior", availability: "Disponibilidade", availabilityPh: "Ex: Imediata", bio: "Bio profissional", bioPh: "Conte brevemente sobre sua trajetória e especialidades...",
    tech: "Tecnologias", skillPh: "Digite uma skill", add: "Adicionar", addWork: "Adicione seus melhores trabalhos", addWorkSub: "Inclua projetos que mostrem suas habilidades na prática.", addManual: "Adicionar manualmente",
    importGh: "Importar projetos do GitHub", importTitle: "Importar do GitHub", importDesc: "Selecione os repositórios que deseja mostrar no perfil.", importSelected: "Importar selecionados", importToast: "Projetos importados com sucesso",
    site: "Site pessoal", sitePh: "seusite.dev", ghPh: "github.com/seuusuario", liPh: "linkedin.com/in/seuusuario",
    back: "Voltar", next: "Continuar", finish: "Concluir perfil", finishToast: "Perfil pronto para publicação!", finishDesc: "Esta é uma demonstração; nada foi enviado.",
  },
  schedule: {
    trigger: "Agendar conversa", duration: "Conversa de 30 minutos", talkWith: "Converse com", desc: "Escolha um horário e conte brevemente sobre a oportunidade.",
    pickDate: "Escolha uma data", times: "Horários disponíveis", selectDate: "Selecione uma data no calendário", next: "Continuar", tz: "Horário de Brasília (GMT−3)", tzShort: "Horário de Brasília",
    company: "Empresa", companyPh: "Nome da sua empresa", email: "E-mail corporativo", emailPh: "voce@empresa.com", about: "Sobre a oportunidade", optional: "(opcional)", aboutPh: "Conte sobre o projeto, desafio ou posição...",
    summary: "Resumo", at: "às", minutes: "30 minutos", video: "Videochamada", videoSub: "Link simulado após confirmar", confirm: "Confirmar horário", change: "Alterar horário",
    done: "Conversa agendada", reservedA: "Seu horário com", reservedB: "foi reservado para", confirmSent: "Uma confirmação simulada foi preparada para", finish: "Concluir",
    dateFormat: "EEEE, d 'de' MMMM",
  },
};

type Dict = typeof pt;

const en: Dict = {
  nav: { discover: "Discover", saved: "Saved talent", create: "Create profile", openMenu: "Open menu", language: "Language" },
  card: { photoOf: "Photo of", viewProfile: "View profile" },
  filters: { title: "Filters", subtitle: "Refine your search", clear: "Clear", tech: "Technologies", seniority: "Seniority", location: "Location", maxRate: "Max rate/h", hiring: "Hiring type" },
  home: {
    eyebrow: "2,400+ verified professionals", h1a: "Find the right developer for your ", h1b: "next project.",
    sub: "Discover professionals with the technologies, experience and availability your company needs.",
    find: "Find talent", createMine: "Create my profile", perks: ["No sign-up", "Verified profiles", "Fast replies"],
    match: "Match with your role", availableNow: "Available now",
    howKicker: "How it works", howTitle: "From brief to match in three steps.",
    steps: [
      { title: "Define what you need", description: "Choose stack, seniority, work model and rate range." },
      { title: "Discover professionals", description: "Browse full profiles and projects relevant to your role." },
      { title: "Save your favorites", description: "Build a shortlist and move forward with the best talent." },
    ],
    benefitsKicker: "Built for better decisions", benefitsTitleA: "Fewer résumés.", benefitsTitleB: "More context.",
    benefitsSub: "See what really matters before the first conversation.",
    benefits: ["Faster search", "Smart filters", "Project-based insights", "Visible availability"],
    benefitText: "Objective information to compare talent with confidence.",
    ctaTitle: "Your next hire is one match away.", ctaSub: "Start now and discover professionals ready to transform your project.", ctaBtn: "Explore talent",
  },
  discover: {
    kicker: "Smart discovery", title: "Find your next hire", sub: "Profiles selected based on your preferences.",
    filtersA11y: "Talent filters", of: "of", profiles: "profiles", none: "No profiles", explored: "explored",
    emptyTitle: "No talent found", emptySub: "Try removing some filters to broaden your search.", clearFilters: "Clear filters",
    interested: "Interested", pass: "Pass", save: "Save", stampYes: "INTERESTED", stampNo: "PASS",
    toastPass: "Profile skipped", toastSave: "Talent saved to your list", toastInterest: "Interest registered",
    compat: "Compatibility", great: "Excellent match", reasons: ["Matching stack", "Ideal experience", "Immediate availability"], fullProfile: "View full profile",
  },
  saved: { kicker: "Your shortlist", title: "Saved talent", sub: "Compare the profiles that best fit your project.", remove: "Remove", emptyTitle: "You haven't saved any talent yet.", emptySub: "Use Discover to build your shortlist." },
  profile: {
    back: "Back to Discover", saved: "Saved", save: "Save", toastRemoved: "Removed from saved", toastSaved: "Talent saved",
    about: "About me", skills: "Skills", experience: "Experience", expCompany: "Digital product", expText: "Technical leadership, application architecture and continuous delivery of high-quality experiences.",
    portfolio: "Portfolio", featured: "Featured projects", availability: "Availability", rate: "Hourly rate", links: "Professional links", portfolioLink: "Portfolio",
  },
  create: {
    steps: ["Personal info", "Skills", "Projects", "Links"], backEdit: "Back to editing", yourName: "Your name", yourRole: "Your professional title",
    yourBio: "Your bio will appear here. Tell us about your experience, how you work and the problems you enjoy solving.",
    projects: "Projects", imported: "Project imported to your portfolio.", addProjectsHint: "Add projects to complete your preview.",
    kicker: "Your mini portfolio", title: "Create a profile that stands out", sub: "It only takes a few minutes.", preview: "Preview profile",
    stepOf: (s: number) => `STEP ${s} OF 4`,
    fullName: "Full name", fullNamePh: "How do you want to be found?", role: "Title", rolePh: "e.g. Frontend Developer", location: "Location", locationPh: "City, state",
    seniority: "Seniority", seniorityPh: "Junior, Mid-level or Senior", availability: "Availability", availabilityPh: "e.g. Immediate", bio: "Professional bio", bioPh: "Briefly describe your background and specialties...",
    tech: "Technologies", skillPh: "Type a skill", add: "Add", addWork: "Add your best work", addWorkSub: "Include projects that show your skills in practice.", addManual: "Add manually",
    importGh: "Import projects from GitHub", importTitle: "Import from GitHub", importDesc: "Select the repositories you want to show on your profile.", importSelected: "Import selected", importToast: "Projects imported successfully",
    site: "Personal website", sitePh: "yoursite.dev", ghPh: "github.com/yourusername", liPh: "linkedin.com/in/yourusername",
    back: "Back", next: "Continue", finish: "Finish profile", finishToast: "Profile ready to publish!", finishDesc: "This is a demo; nothing was sent.",
  },
  schedule: {
    trigger: "Schedule a call", duration: "30-minute call", talkWith: "Talk with", desc: "Pick a time and briefly describe the opportunity.",
    pickDate: "Pick a date", times: "Available times", selectDate: "Select a date on the calendar", next: "Continue", tz: "Brasília time (GMT−3)", tzShort: "Brasília time",
    company: "Company", companyPh: "Your company name", email: "Work email", emailPh: "you@company.com", about: "About the opportunity", optional: "(optional)", aboutPh: "Tell us about the project, challenge or role...",
    summary: "Summary", at: "at", minutes: "30 minutes", video: "Video call", videoSub: "Mock link after confirming", confirm: "Confirm time", change: "Change time",
    done: "Call scheduled", reservedA: "Your slot with", reservedB: "is booked for", confirmSent: "A mock confirmation was prepared for", finish: "Done",
    dateFormat: "EEEE, MMMM d",
  },
};

// Translations for mock data values (stored in Portuguese).
const dataEn: Record<string, string> = {
  "Júnior": "Junior", "Pleno": "Mid-level", "Sênior": "Senior",
  "Remoto": "Remote", "Híbrido": "Hybrid", "Presencial": "On-site",
  "Disponível agora": "Available now", "Em 15 dias": "In 15 days", "Em 30 dias": "In 30 days", "Contrato": "Contract",
  "Transformo desafios de produto em experiências digitais simples, confiáveis e orientadas a resultados. Gosto de trabalhar próximo ao negócio e colaborar com times multidisciplinares.":
    "I turn product challenges into simple, reliable, results-driven digital experiences. I enjoy working close to the business and collaborating with cross-functional teams.",
  "Checkout modular que reduziu o abandono em 24%.": "Modular checkout that cut cart abandonment by 24%.",
  "Plataforma comercial com automações e analytics.": "Sales platform with automations and analytics.",
  "APIs resilientes para operações financeiras.": "Resilient APIs for financial operations.",
  "Biblioteca acessível usada por 12 squads.": "Accessible library used by 12 squads.",
  "Dashboard de métricas em tempo real.": "Real-time metrics dashboard.",
  "Experiência de agendamento para clínicas.": "Booking experience for clinics.",
  "Serviços de conciliação com alta disponibilidade.": "Highly available reconciliation services.",
  "Motor logístico para entregas nacionais.": "Logistics engine for nationwide deliveries.",
  "Monitoramento distribuído para microsserviços.": "Distributed monitoring for microservices.",
  "Governança multi-cloud e controle de custos.": "Multi-cloud governance and cost control.",
  "Portal interno para deploys autônomos.": "Internal portal for self-service deploys.",
  "Pipeline orientado a eventos em grande escala.": "Large-scale event-driven pipeline.",
};

type I18nState = { lang: Lang; setLang: (l: Lang) => void; t: Dict; tv: (value: string) => string };
const store = globalThis as unknown as { __stackmatchI18n?: React.Context<I18nState | null> };
const I18nContext = (store.__stackmatchI18n ??= createContext<I18nState | null>(null));

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    const stored = window.localStorage.getItem("stackmatch-lang");
    if (stored === "pt" || stored === "en") setLangState(stored);
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "pt" ? "pt-BR" : "en"; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); window.localStorage.setItem("stackmatch-lang", l); };
  const tv = (value: string) => {
    if (lang === "pt") return value;
    const years = value.match(/^(\d+) anos$/);
    if (years) return `${years[1]} years`;
    return dataEn[value] ?? value;
  };
  return <I18nContext.Provider value={{ lang, setLang, t: lang === "pt" ? pt : en, tv }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
