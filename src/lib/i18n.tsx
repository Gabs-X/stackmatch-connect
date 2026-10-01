import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "pt" | "en";

const pt = {
  common: {
    close: "Fechar",
    notFound: "Página não encontrada",
    notFoundDescription: "A página que você procura não existe ou foi movida.",
    home: "Ir para o início",
    error: "Não foi possível carregar esta página",
    errorDescription: "Ocorreu um erro. Tente novamente ou volte ao início.",
    retry: "Tentar novamente",
    loading: "Carregando...",
  },
  nav: {
    discover: "Discover",
    saved: "Talentos salvos",
    create: "Criar perfil",
    openMenu: "Abrir menu",
    language: "Idioma",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Escuro",
  },
  card: { photoOf: "Foto de", viewProfile: "Ver perfil", yourProfile: "Seu perfil" },
  filters: {
    title: "Filtros",
    subtitle: "Refine sua busca",
    clear: "Limpar",
    tech: "Tecnologias",
    seniority: "Senioridade",
    location: "Modelo de trabalho",
    availability: "Disponibilidade",
    remove: "Remover filtro",
    maxRate: "Valor máximo/h",
    hiring: "Contratação",
  },
  home: {
    eyebrow: "Mais de 2.400 talentos verificados",
    h1a: "Encontre o desenvolvedor certo para o seu ",
    h1b: "próximo projeto.",
    sub: "Descubra profissionais com as tecnologias, experiência e disponibilidade que sua empresa precisa.",
    find: "Encontrar talentos",
    createMine: "Criar meu perfil",
    perks: ["Sem cadastro", "Perfis verificados", "Resposta rápida"],
    match: "Match com sua vaga",
    availableNow: "Disponível agora",
    howKicker: "Como funciona",
    howTitle: "Do briefing ao match em três passos.",
    steps: [
      {
        title: "Defina o que procura",
        description: "Escolha stack, senioridade, modelo de trabalho e faixa de valor.",
      },
      {
        title: "Descubra profissionais",
        description: "Explore perfis completos e projetos relevantes para sua vaga.",
      },
      {
        title: "Salve seus favoritos",
        description: "Monte uma shortlist e avance com os melhores talentos.",
      },
    ],
    benefitsKicker: "Feito para decidir melhor",
    benefitsTitleA: "Menos currículos.",
    benefitsTitleB: "Mais contexto.",
    benefitsSub: "Veja o que realmente importa antes da primeira conversa.",
    benefits: [
      "Busca mais rápida",
      "Filtros inteligentes",
      "Análise por projetos",
      "Disponibilidade visível",
    ],
    benefitText: "Informações objetivas para comparar talentos com confiança.",
    ctaTitle: "Seu próximo talento está a um match de distância.",
    ctaSub: "Comece agora e descubra profissionais prontos para transformar seu projeto.",
    ctaBtn: "Explorar talentos",
  },
  discover: {
    kicker: "Descoberta inteligente",
    title: "Encontre seu próximo talento",
    sub: "Perfis selecionados com base nas suas preferências.",
    filtersA11y: "Filtros de talentos",
    of: "de",
    profiles: (count: number): string => (count === 1 ? "perfil" : "perfis"),
    none: "Nenhum perfil",
    explored: "explorado",
    emptyTitle: "Nenhum talento encontrado",
    emptySub: "Tente remover alguns filtros para ampliar a busca.",
    clearFilters: "Limpar filtros",
    interested: "Interessado",
    pass: "Passar",
    save: "Salvar",
    stampYes: "INTERESSADO",
    stampNo: "PASSAR",
    toastPass: "Perfil ignorado",
    toastSave: "Talento salvo na sua lista",
    toastInterest: "Interesse registrado",
    undo: "Desfazer",
    undone: "Ação desfeita",
    loadError: "Não foi possível carregar os talentos",
    loadErrorSub: "Verifique sua conexão e tente novamente.",
    saveFeedback: "salvo na shortlist.",
    interestFeedback: "interesse registrado localmente e perfil salvo. Nenhum contato foi enviado.",
    finishedTitle: "Você chegou ao fim da lista",
    finishedSub: "Revise estes perfis novamente ou ajuste os filtros para uma nova busca.",
    restart: "Rever perfis",
    compat: "Resumo do perfil",
    great: "Excelente match",
    reasons: ["Stack compatível", "Experiência ideal", "Disponibilidade imediata"],
    fullProfile: "Ver perfil completo",
  },
  saved: {
    kicker: "Sua shortlist",
    title: "Talentos salvos",
    sub: "Compare os perfis que mais combinam com seu projeto.",
    remove: "Remover",
    emptyTitle: "Você ainda não salvou nenhum talento.",
    emptySub: "Use o Discover para montar sua shortlist.",
  },
  profile: {
    back: "Voltar ao Discover",
    saved: "Salvo",
    save: "Salvar",
    toastRemoved: "Removido dos salvos",
    toastSaved: "Talento salvo",
    about: "Sobre mim",
    skills: "Skills",
    experience: "Experiência",
    expCompany: "Produto digital",
    expText:
      "Liderança técnica, arquitetura de aplicações e entrega contínua de experiências de alta qualidade.",
    portfolio: "Portfólio",
    featured: "Projetos em destaque",
    availability: "Disponibilidade",
    rate: "Valor por hora",
    links: "Links profissionais",
    portfolioLink: "Portfólio",
    demoNote: "Perfil fictício: os links mostram endereços de exemplo.",
    demoLinkTitle: "Link de demonstração",
    demoLinkDesc: (url: string) =>
      `Este perfil é fictício. Em um perfil real, este link abriria ${url}.`,
    openLink: (label: string, url: string) => `${label}: ${url} (demonstração)`,
    openRealLink: (label: string, url: string) => `${label}: ${url} (abre em nova aba)`,
    projectsDemoNote: "Os links dos projetos mostram endereços de exemplo.",
  },
  create: {
    steps: ["Informações pessoais", "Skills", "Projetos", "Links"],
    backEdit: "Voltar à edição",
    yourName: "Seu nome",
    yourRole: "Seu cargo profissional",
    yourBio:
      "Sua biografia aparecerá aqui. Conte sobre sua experiência, seu jeito de trabalhar e os problemas que você gosta de resolver.",
    projects: "Projetos",
    projectName: "Nome do projeto",
    manualDesc: "Conte o que você construiu, com quais tecnologias e onde ver o resultado.",
    addProjectsHint: "Adicione projetos para completar sua prévia.",
    editProject: "Editar projeto",
    editProjectA11y: (name: string) => `Editar ${name}`,
    removeProjectA11y: (name: string) => `Remover ${name}`,
    saveProject: "Salvar projeto",
    cancel: "Cancelar",
    projectNamePh: "Ex: Plataforma de agendamentos",
    projectDesc: "Descrição",
    projectDescPh: "Que problema o projeto resolve e qual foi o seu papel?",
    projectTech: "Tecnologias do projeto",
    projectTechPh: "Digite e pressione Enter",
    fromSkills: "Das suas skills:",
    removeTech: (tech: string) => `Remover ${tech}`,
    projectImage: "Imagem de capa",
    projectImageHint: "PNG, JPG ou WebP. A imagem é reduzida e salva só neste navegador.",
    chooseImage: "Escolher imagem",
    changeImage: "Trocar imagem",
    removeImage: "Remover imagem",
    imageError: "Não foi possível usar essa imagem. Escolha um arquivo PNG, JPG ou WebP.",
    projectRepo: "Repositório (GitHub)",
    projectRepoPh: "github.com/usuario/projeto",
    projectDemo: "Link da demonstração",
    projectDemoPh: "meuprojeto.vercel.app",
    invalidUrl: "Informe um endereço válido, como https://exemplo.com.",
    duplicateProject: "Já existe um projeto com esse nome.",
    projectNameRequired: "Dê um nome ao projeto.",
    projectSaved: "Projeto salvo",
    projectRemoved: "Projeto removido",
    noDescription: "Sem descrição ainda. Edite o projeto para contar mais sobre ele.",
    importRepos: [
      {
        name: "Ecommerce API",
        description: "API de pedidos, pagamentos e estoque para lojas virtuais.",
        tech: ["Node.js", "NestJS", "PostgreSQL"],
      },
      {
        name: "Portfolio",
        description: "Site pessoal com projetos, artigos e formulário de contato.",
        tech: ["Next.js", "Tailwind"],
      },
      {
        name: "Task Manager",
        description: "Gerenciador de tarefas com quadros, prazos e colaboração em tempo real.",
        tech: ["React", "Node.js", "MongoDB"],
      },
      {
        name: "Finance Dashboard",
        description: "Painel de finanças pessoais com gráficos de gastos e metas.",
        tech: ["React", "TypeScript", "Recharts"],
      },
    ],
    kicker: "Seu mini portfólio",
    title: "Crie um perfil que se destaca",
    sub: "Leva apenas alguns minutos para ficar pronto.",
    preview: "Visualizar perfil",
    stepOf: (s: number) => `ETAPA ${s} DE 4`,
    fullName: "Nome completo",
    fullNamePh: "Como você quer ser encontrado?",
    role: "Cargo",
    rolePh: "Ex: Frontend Developer",
    location: "Localização",
    locationPh: "Cidade, estado",
    seniority: "Senioridade",
    selectPh: "Selecione",
    workMode: "Modelo de trabalho",
    viewInDiscover: "Ver no Discover",
    availability: "Disponibilidade",
    bio: "Bio profissional",
    bioPh: "Conte brevemente sobre sua trajetória e especialidades...",
    tech: "Tecnologias",
    skillPh: "Digite uma skill",
    add: "Adicionar",
    addWork: "Adicione seus melhores trabalhos",
    addWorkSub: "Inclua projetos que mostrem suas habilidades na prática.",
    addManual: "Adicionar manualmente",
    importGh: "Simular importação do GitHub",
    importTitle: "Importar do GitHub",
    importDesc: "Simulação local: selecione projetos fictícios para mostrar no perfil.",
    importSelected: "Importar selecionados",
    importToast: "Projetos importados com sucesso",
    site: "Site pessoal",
    sitePh: "seusite.dev",
    ghPh: "github.com/seuusuario",
    liPh: "linkedin.com/in/seuusuario",
    back: "Voltar",
    next: "Continuar",
    finish: "Concluir perfil",
    finishToast: "Perfil salvo neste navegador!",
    finishDesc: "Demonstração local; nenhum dado foi enviado ou publicado.",
    requiredFields: "Preencha seu nome e cargo antes de concluir.",
    saveError:
      "Não foi possível salvar o perfil neste navegador. Seus dados continuam no formulário.",
  },
  schedule: {
    trigger: "Agendar conversa",
    duration: "Conversa de 30 minutos",
    talkWith: "Converse com",
    desc: "Escolha um horário e conte brevemente sobre a oportunidade.",
    pickDate: "Escolha uma data",
    times: "Horários disponíveis",
    selectDate: "Selecione uma data no calendário",
    next: "Continuar",
    tz: "Horário de Brasília (GMT−3)",
    tzShort: "Horário de Brasília",
    company: "Empresa",
    companyPh: "Nome da sua empresa",
    email: "E-mail corporativo",
    emailPh: "voce@empresa.com",
    about: "Sobre a oportunidade",
    optional: "(opcional)",
    aboutPh: "Conte sobre o projeto, desafio ou posição...",
    summary: "Resumo",
    at: "às",
    minutes: "30 minutos",
    video: "Videochamada",
    videoSub: "Demonstração local; nenhum link de videochamada é gerado",
    confirm: "Confirmar horário",
    change: "Alterar horário",
    unavailable: "Este horário não está mais disponível. Escolha outro.",
    storageError: "Não foi possível salvar neste navegador. Tente novamente.",
    done: "Agendamento salvo neste navegador",
    reservedA: "Seu horário com",
    reservedB: "foi reservado para",
    confirmSent: "Nenhum e-mail foi enviado. Contato registrado localmente:",
    finish: "Concluir",
    dateFormat: "EEEE, d 'de' MMMM",
  },
  assistant: {
    open: "Abrir assistente",
    close: "Fechar assistente",
    title: "Assistente StackMatch",
    status: "Prévia · IA em breve",
    badge: "Beta",
    greetingTitle: "Olá! Como posso ajudar?",
    greetingSub:
      "Tire dúvidas sobre como encontrar talentos, montar seu perfil de desenvolvedor ou agendar uma conversa.",
    suggestionsLabel: "Sugestões",
    suggestions: [
      "Como funciona o Discover?",
      "Como criar meu perfil de desenvolvedor?",
      "Como agendar uma conversa?",
    ],
    inputLabel: "Mensagem para o assistente",
    placeholder: "Escreva sua mensagem...",
    send: "Enviar",
    stop: "Parar resposta",
    reset: "Nova conversa",
    typing: "Assistente digitando",
    you: "Você",
    disclaimer: "Prévia: a IA ainda não está conectada e as respostas são simuladas.",
    error: "Não foi possível obter uma resposta. Tente novamente.",
    retry: "Tentar novamente",
    previewReply:
      "Obrigado pela mensagem! Ainda estou em modo de prévia: a integração com IA será conectada junto com o backend do StackMatch. Em breve vou poder tirar dúvidas sobre o Discover, filtros, perfis e agendamentos.",
  },
};

type Dict = typeof pt;

const en: Dict = {
  common: {
    close: "Close",
    notFound: "Page not found",
    notFoundDescription: "The page you're looking for doesn't exist or has been moved.",
    home: "Go home",
    error: "This page didn't load",
    errorDescription: "Something went wrong. Try again or head back home.",
    retry: "Try again",
    loading: "Loading...",
  },
  nav: {
    discover: "Discover",
    saved: "Saved talent",
    create: "Create profile",
    openMenu: "Open menu",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
  },
  card: { photoOf: "Photo of", viewProfile: "View profile", yourProfile: "Your profile" },
  filters: {
    title: "Filters",
    subtitle: "Refine your search",
    clear: "Clear",
    tech: "Technologies",
    seniority: "Seniority",
    location: "Work model",
    availability: "Availability",
    remove: "Remove filter",
    maxRate: "Max rate/h",
    hiring: "Hiring type",
  },
  home: {
    eyebrow: "2,400+ verified professionals",
    h1a: "Find the right developer for your ",
    h1b: "next project.",
    sub: "Discover professionals with the technologies, experience and availability your company needs.",
    find: "Find talent",
    createMine: "Create my profile",
    perks: ["No sign-up", "Verified profiles", "Fast replies"],
    match: "Match with your role",
    availableNow: "Available now",
    howKicker: "How it works",
    howTitle: "From brief to match in three steps.",
    steps: [
      {
        title: "Define what you need",
        description: "Choose stack, seniority, work model and rate range.",
      },
      {
        title: "Discover professionals",
        description: "Browse full profiles and projects relevant to your role.",
      },
      {
        title: "Save your favorites",
        description: "Build a shortlist and move forward with the best talent.",
      },
    ],
    benefitsKicker: "Built for better decisions",
    benefitsTitleA: "Fewer résumés.",
    benefitsTitleB: "More context.",
    benefitsSub: "See what really matters before the first conversation.",
    benefits: ["Faster search", "Smart filters", "Project-based insights", "Visible availability"],
    benefitText: "Objective information to compare talent with confidence.",
    ctaTitle: "Your next hire is one match away.",
    ctaSub: "Start now and discover professionals ready to transform your project.",
    ctaBtn: "Explore talent",
  },
  discover: {
    kicker: "Smart discovery",
    title: "Find your next hire",
    sub: "Profiles selected based on your preferences.",
    filtersA11y: "Talent filters",
    of: "of",
    profiles: (count: number) => (count === 1 ? "profile" : "profiles"),
    none: "No profiles",
    explored: "explored",
    emptyTitle: "No talent found",
    emptySub: "Try removing some filters to broaden your search.",
    clearFilters: "Clear filters",
    interested: "Interested",
    pass: "Pass",
    save: "Save",
    stampYes: "INTERESTED",
    stampNo: "PASS",
    toastPass: "Profile skipped",
    toastSave: "Talent saved to your list",
    toastInterest: "Interest registered",
    undo: "Undo",
    undone: "Action undone",
    loadError: "Couldn't load talent",
    loadErrorSub: "Check your connection and try again.",
    saveFeedback: "saved to your shortlist.",
    interestFeedback: "interest recorded locally and profile saved. No contact was sent.",
    finishedTitle: "You reached the end of the list",
    finishedSub: "Review these profiles again or adjust your filters for a new search.",
    restart: "Review profiles",
    compat: "Profile summary",
    great: "Excellent match",
    reasons: ["Matching stack", "Ideal experience", "Immediate availability"],
    fullProfile: "View full profile",
  },
  saved: {
    kicker: "Your shortlist",
    title: "Saved talent",
    sub: "Compare the profiles that best fit your project.",
    remove: "Remove",
    emptyTitle: "You haven't saved any talent yet.",
    emptySub: "Use Discover to build your shortlist.",
  },
  profile: {
    back: "Back to Discover",
    saved: "Saved",
    save: "Save",
    toastRemoved: "Removed from saved",
    toastSaved: "Talent saved",
    about: "About me",
    skills: "Skills",
    experience: "Experience",
    expCompany: "Digital product",
    expText:
      "Technical leadership, application architecture and continuous delivery of high-quality experiences.",
    portfolio: "Portfolio",
    featured: "Featured projects",
    availability: "Availability",
    rate: "Hourly rate",
    links: "Professional links",
    portfolioLink: "Portfolio",
    demoNote: "Fictional profile: links show example addresses.",
    demoLinkTitle: "Demo link",
    demoLinkDesc: (url: string) =>
      `This profile is fictional. On a real profile, this link would open ${url}.`,
    openLink: (label: string, url: string) => `${label}: ${url} (demo)`,
    openRealLink: (label: string, url: string) => `${label}: ${url} (opens in a new tab)`,
    projectsDemoNote: "Project links show example addresses.",
  },
  create: {
    steps: ["Personal info", "Skills", "Projects", "Links"],
    backEdit: "Back to editing",
    yourName: "Your name",
    yourRole: "Your professional title",
    yourBio:
      "Your bio will appear here. Tell us about your experience, how you work and the problems you enjoy solving.",
    projects: "Projects",
    projectName: "Project name",
    manualDesc: "Describe what you built, which technologies you used and where to see it.",
    addProjectsHint: "Add projects to complete your preview.",
    editProject: "Edit project",
    editProjectA11y: (name: string) => `Edit ${name}`,
    removeProjectA11y: (name: string) => `Remove ${name}`,
    saveProject: "Save project",
    cancel: "Cancel",
    projectNamePh: "e.g. Booking platform",
    projectDesc: "Description",
    projectDescPh: "What problem does it solve and what was your role?",
    projectTech: "Project technologies",
    projectTechPh: "Type and press Enter",
    fromSkills: "From your skills:",
    removeTech: (tech: string) => `Remove ${tech}`,
    projectImage: "Cover image",
    projectImageHint: "PNG, JPG or WebP. The image is downsized and saved only in this browser.",
    chooseImage: "Choose image",
    changeImage: "Change image",
    removeImage: "Remove image",
    imageError: "Couldn't use this image. Choose a PNG, JPG or WebP file.",
    projectRepo: "Repository (GitHub)",
    projectRepoPh: "github.com/username/project",
    projectDemo: "Demo link",
    projectDemoPh: "myproject.vercel.app",
    invalidUrl: "Enter a valid address, such as https://example.com.",
    duplicateProject: "A project with this name already exists.",
    projectNameRequired: "Give the project a name.",
    projectSaved: "Project saved",
    projectRemoved: "Project removed",
    noDescription: "No description yet. Edit the project to tell more about it.",
    importRepos: [
      {
        name: "Ecommerce API",
        description: "Orders, payments and inventory API for online stores.",
        tech: ["Node.js", "NestJS", "PostgreSQL"],
      },
      {
        name: "Portfolio",
        description: "Personal site with projects, articles and a contact form.",
        tech: ["Next.js", "Tailwind"],
      },
      {
        name: "Task Manager",
        description: "Task manager with boards, deadlines and real-time collaboration.",
        tech: ["React", "Node.js", "MongoDB"],
      },
      {
        name: "Finance Dashboard",
        description: "Personal finance dashboard with spending charts and goals.",
        tech: ["React", "TypeScript", "Recharts"],
      },
    ],
    kicker: "Your mini portfolio",
    title: "Create a profile that stands out",
    sub: "It only takes a few minutes.",
    preview: "Preview profile",
    stepOf: (s: number) => `STEP ${s} OF 4`,
    fullName: "Full name",
    fullNamePh: "How do you want to be found?",
    role: "Title",
    rolePh: "e.g. Frontend Developer",
    location: "Location",
    locationPh: "City, state",
    seniority: "Seniority",
    selectPh: "Select",
    workMode: "Work model",
    viewInDiscover: "See it in Discover",
    availability: "Availability",
    bio: "Professional bio",
    bioPh: "Briefly describe your background and specialties...",
    tech: "Technologies",
    skillPh: "Type a skill",
    add: "Add",
    addWork: "Add your best work",
    addWorkSub: "Include projects that show your skills in practice.",
    addManual: "Add manually",
    importGh: "Simulate GitHub import",
    importTitle: "Import from GitHub",
    importDesc: "Local simulation: select sample projects to show on your profile.",
    importSelected: "Import selected",
    importToast: "Projects imported successfully",
    site: "Personal website",
    sitePh: "yoursite.dev",
    ghPh: "github.com/yourusername",
    liPh: "linkedin.com/in/yourusername",
    back: "Back",
    next: "Continue",
    finish: "Finish profile",
    finishToast: "Profile saved in this browser!",
    finishDesc: "Local demo; no data was sent or published.",
    requiredFields: "Enter your name and title before finishing.",
    saveError: "Couldn't save the profile in this browser. Your data is still in the form.",
  },
  schedule: {
    trigger: "Schedule a call",
    duration: "30-minute call",
    talkWith: "Talk with",
    desc: "Pick a time and briefly describe the opportunity.",
    pickDate: "Pick a date",
    times: "Available times",
    selectDate: "Select a date on the calendar",
    next: "Continue",
    tz: "Brasília time (GMT−3)",
    tzShort: "Brasília time",
    company: "Company",
    companyPh: "Your company name",
    email: "Work email",
    emailPh: "you@company.com",
    about: "About the opportunity",
    optional: "(optional)",
    aboutPh: "Tell us about the project, challenge or role...",
    summary: "Summary",
    at: "at",
    minutes: "30 minutes",
    video: "Video call",
    videoSub: "Local demo; no video call link is generated",
    confirm: "Confirm time",
    change: "Change time",
    unavailable: "This time is no longer available. Choose another.",
    storageError: "Could not save in this browser. Please try again.",
    done: "Appointment saved in this browser",
    reservedA: "Your slot with",
    reservedB: "is booked for",
    confirmSent: "No email was sent. Contact saved locally:",
    finish: "Done",
    dateFormat: "EEEE, MMMM d",
  },
  assistant: {
    open: "Open assistant",
    close: "Close assistant",
    title: "StackMatch Assistant",
    status: "Preview · AI coming soon",
    badge: "Beta",
    greetingTitle: "Hi! How can I help?",
    greetingSub:
      "Ask about finding talent, building your developer profile or scheduling a conversation.",
    suggestionsLabel: "Suggestions",
    suggestions: [
      "How does Discover work?",
      "How do I create my developer profile?",
      "How do I schedule a conversation?",
    ],
    inputLabel: "Message to the assistant",
    placeholder: "Type your message...",
    send: "Send",
    stop: "Stop reply",
    reset: "New conversation",
    typing: "Assistant is typing",
    you: "You",
    disclaimer: "Preview: the AI isn't connected yet, so replies are simulated.",
    error: "Couldn't get a reply. Please try again.",
    retry: "Try again",
    previewReply:
      "Thanks for your message! I'm still in preview mode: the AI integration will be connected together with the StackMatch backend. Soon I'll be able to answer questions about Discover, filters, profiles and scheduling.",
  },
};

// Translations for mock data values (stored in Portuguese).
const dataEn: Record<string, string> = {
  "Aplicativo de rotas com autenticação e favoritos.":
    "Route planning app with authentication and favorites.",
  "Registro de hábitos com sincronização entre dispositivos.":
    "Habit tracking with synchronization across devices.",
  "Integração de pedidos entre sistemas corporativos.":
    "Order integration across enterprise systems.",
  "Portal de atendimento com APIs hospedadas em Azure.":
    "Support portal with APIs hosted on Azure.",
  "Ingestão e transformação de dados com execução agendada.":
    "Scheduled data ingestion and transformation.",
  "Validação de qualidade em tabelas analíticas.": "Quality validation for analytics tables.",
  "Organizador de estudos com tarefas e progresso.": "Study organizer with tasks and progress.",
  "Catálogo de produtos com cadastro e busca.": "Product catalog with entry forms and search.",
  "Desenvolvo aplicações full stack com React e Node.js, integrando interfaces, APIs e bancos relacionais.":
    "I build full stack applications with React and Node.js, connecting interfaces, APIs and relational databases.",
  "Sou especialista em interfaces React, acessibilidade e design systems. Colaboro com produto e design para evoluir experiências web.":
    "I specialize in React interfaces, accessibility and design systems, collaborating with product and design to improve web experiences.",
  "Projeto APIs e serviços backend com Java e Node.js, com foco em observabilidade, integração e confiabilidade.":
    "I design APIs and backend services with Java and Node.js, focusing on observability, integration and reliability.",
  "Automatizo infraestrutura em AWS com Terraform e Python e mantenho pipelines de deploy para aplicações em containers.":
    "I automate AWS infrastructure with Terraform and Python and maintain deployment pipelines for containerized applications.",
  "Crio aplicativos em React Native com TypeScript, integrando autenticação, notificações e sincronização com Firebase.":
    "I build React Native apps with TypeScript, integrating authentication, notifications and Firebase synchronization.",
  "Desenvolvo sistemas corporativos em C# e .NET, modernizando APIs e integrações com Azure e SQL Server.":
    "I build enterprise systems in C# and .NET, modernizing APIs and integrations with Azure and SQL Server.",
  "Construo pipelines de dados com Python e Airflow, organizando ingestão, transformação e qualidade de dados em AWS.":
    "I build data pipelines with Python and Airflow, organizing ingestion, transformation and data quality on AWS.",
  "Estou consolidando minha experiência com Vue e Node.js em aplicações de pequeno porte, com revisão de código e colaboração do time.":
    "I am developing my Vue and Node.js experience on small applications, supported by code reviews and team collaboration.",
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
  "Transformo desafios de produto em experiências digitais simples, confiáveis e orientadas a resultados. Gosto de trabalhar próximo ao negócio e colaborar com times multidisciplinares.":
    "I turn product challenges into simple, reliable, results-driven digital experiences. I enjoy working close to the business and collaborating with cross-functional teams.",
  "Checkout modular que reduziu o abandono em 24%.":
    "Modular checkout that cut cart abandonment by 24%.",
  "Plataforma comercial com automações e analytics.":
    "Sales platform with automations and analytics.",
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

type I18nState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  tv: (value: string) => string;
  formatCurrency: (value: number) => string;
};
const store = globalThis as unknown as { __stackmatchI18n?: React.Context<I18nState | null> };
const I18nContext = (store.__stackmatchI18n ??= createContext<I18nState | null>(null));

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("stackmatch-lang");
      if (stored === "pt" || stored === "en") setLangState(stored);
    } catch {
      /* Keep the default when browser storage is unavailable. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("stackmatch-lang", l);
    } catch {
      /* Language switching still works without persistence. */
    }
  };
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  const tv = (value: string) => {
    if (lang === "pt") return value;
    const years = value.match(/^(\d+) anos$/);
    if (years) return `${years[1]} years`;
    return dataEn[value] ?? value;
  };
  return (
    <I18nContext.Provider value={{ lang, setLang, t: lang === "pt" ? pt : en, tv, formatCurrency }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}

// Static route metadata supplies the PT-BR server render; update it after navigation
// or a language change without adding locale-specific routes to this prototype.
export function useLocalizedMeta(title: string, description: string) {
  useEffect(() => {
    document.title = "Stack Match";
    for (const [selector, content] of [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
    ]) {
      if (selector && content)
        document
          .querySelectorAll(selector)
          .forEach((meta) => meta.setAttribute("content", content));
    }
  }, [title, description]);
}
