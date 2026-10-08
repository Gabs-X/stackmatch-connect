import type { Lang } from "./i18n";

/**
 * The terms of use and privacy notice shown at /terms. They describe what the app really does
 * with data; when a feature, a provider or a retention period changes, change this text too.
 */

export type LegalSection = { id: string; title: string; paragraphs?: string[]; items?: string[] };

export type LegalText = {
  kicker: string;
  title: string;
  sub: string;
  updated: string;
  contents: string;
  termsTitle: string;
  privacyTitle: string;
  terms: LegalSection[];
  privacy: LegalSection[];
  contact: string;
  contactLink: string;
};

export const legalUpdatedAt = "2026-10-07";

const pt: LegalText = {
  kicker: "Legal",
  title: "Termos de uso e privacidade",
  sub: "As regras para usar o StackMatch e como tratamos os seus dados, em linguagem direta.",
  updated: "Atualizado em 7 de outubro de 2026.",
  contents: "Nesta página",
  termsTitle: "Termos de uso",
  privacyTitle: "Política de privacidade",
  terms: [
    {
      id: "terms-about",
      title: "1. O que é o StackMatch",
      paragraphs: [
        "O StackMatch é uma plataforma em que empresas descobrem desenvolvedores e freelancers, e desenvolvedores mostram suas habilidades e projetos. Ao criar uma conta ou usar o site, você concorda com estes termos e com a política de privacidade abaixo.",
      ],
    },
    {
      id: "terms-accounts",
      title: "2. Contas",
      items: [
        "Há dois tipos de conta, empresa e desenvolvedor, escolhidos no cadastro. Para criar uma conta, você precisa ter pelo menos 18 anos.",
        "Informe dados verdadeiros. Contas de empresa precisam de um CNPJ válido e de uma pessoa que fale em nome dela.",
        "Você é responsável pela sua senha e pelo que é feito com a sua conta. Se suspeitar de acesso indevido, troque a senha em Conta e abra um ticket no Suporte.",
      ],
    },
    {
      id: "terms-use",
      title: "3. Uso permitido",
      items: [
        "Empresas usam os contatos e perfis só para processos de contratação ou projetos, nunca para enviar propaganda ou repassar os dados a terceiros.",
        "Não é permitido criar perfis falsos, se passar por outra pessoa ou empresa, enviar conteúdo ofensivo ou ilegal, nem copiar perfis em massa com robôs.",
        "Os limites de interesses, propostas, e-mails e perguntas à Ada protegem quem usa o site. Não tente contorná-los.",
      ],
    },
    {
      id: "terms-content",
      title: "4. Seu conteúdo",
      paragraphs: [
        "O que você escreve e envia (perfil, foto, projetos, dados da empresa, mensagens) continua sendo seu. Você autoriza o StackMatch a exibir esse conteúdo no site para as finalidades descritas aqui, como mostrar o perfil publicado às empresas. Envie só o que você tem o direito de publicar.",
        "O perfil publicado de um desenvolvedor pode ser aberto por qualquer pessoa que tenha o link.",
      ],
    },
    {
      id: "terms-limits",
      title: "5. O que o StackMatch não faz",
      items: [
        "Não avalia nem certifica profissionais e não calcula compatibilidade. As informações dos perfis são de responsabilidade de quem as escreveu.",
        "Não intermedeia contratos, pagamentos nem reuniões. Propostas e respostas vão por e-mail entre as partes.",
        "Não garante contratação, resposta ou disponibilidade de ninguém.",
      ],
    },
    {
      id: "terms-ada",
      title: "6. Ada, a assistente de IA",
      paragraphs: [
        "A Ada é uma inteligência artificial, não uma pessoa. Ela responde com base em um guia do produto e pode errar: confira as informações importantes nas próprias telas. Não compartilhe senhas, códigos ou dados sensíveis com ela. Quando precisar de uma pessoa, abra um ticket no Suporte.",
      ],
    },
    {
      id: "terms-end",
      title: "7. Encerramento e mudanças",
      paragraphs: [
        "Você pode excluir sua conta a qualquer momento em Conta. Podemos suspender ou excluir contas que violem estes termos. Se os termos mudarem de forma relevante, avisaremos no site, e a data no topo desta página será atualizada.",
      ],
    },
  ],
  privacy: [
    {
      id: "privacy-data",
      title: "1. Dados que tratamos",
      items: [
        "Conta: nome, e-mail, senha (guardada só como hash, nunca em texto), tipo de conta, cargo e, para empresas, nome da empresa e CNPJ.",
        "Perfil de desenvolvedor: foto, localização, senioridade, experiência, disponibilidade, bio, skills, projetos e links, além da tradução automática do cargo, da bio e das descrições dos projetos para o outro idioma do site.",
        "Dados da empresa: site, localização, descrição e o contato que os desenvolvedores veem (nome, cargo, e-mail e telefone).",
        "Interações: talentos salvos, marcações de interesse, propostas de reunião e as mensagens enviadas nelas.",
        "Ada: as perguntas e respostas da conversa, que fica guardada na sua conta (a Ada só conversa com quem entrou em uma conta).",
        "Suporte: os tickets que você abre e, se você escolher, a conversa com a Ada anexada a eles.",
        "Dados técnicos: endereço IP, usado para limites de segurança (tentativas de login, e-mails, perguntas e tickets), e o cookie da sessão.",
      ],
    },
    {
      id: "privacy-purposes",
      title: "2. Para que usamos",
      paragraphs: [
        "Para oferecer o serviço que você pediu (execução do contrato): manter sua conta, mostrar perfis, enviar avisos de interesse e propostas, responder pela Ada e atender tickets. Para proteger o site e as pessoas (legítimo interesse): limites de tentativas e de envios, prevenção de abuso e investigação de problemas. Não vendemos seus dados e não os usamos para publicidade.",
      ],
    },
    {
      id: "privacy-sharing",
      title: "3. Com quem compartilhamos",
      items: [
        "Empresas com conta veem os perfis publicados. Desenvolvedores veem os dados de contato das empresas que os procuraram.",
        "Vercel: hospedagem do site, armazenamento das imagens e, quando ativada, a contagem de visitas (sem cookies).",
        "Neon: banco de dados.",
        "Resend: envio dos e-mails.",
        "DeepL: traduz os textos livres dos perfis e da empresa (cargo, bio, descrições) entre português e inglês.",
        "Anthropic: processa as conversas com a Ada para gerar as respostas.",
        "GitHub: quando um perfil usa o avatar do GitHub, o navegador busca a imagem diretamente lá.",
        "Esses fornecedores podem tratar dados fora do Brasil, com as garantias previstas na LGPD.",
      ],
    },
    {
      id: "privacy-retention",
      title: "4. Por quanto tempo guardamos",
      items: [
        "Os dados da conta ficam enquanto ela existir. Excluir a conta apaga perfil, projetos, imagens, dados da empresa, talentos salvos, interesses, propostas e a conversa com a Ada.",
        "Registros de segurança ficam pouco tempo: falhas de login, 15 minutos; envios de e-mail com código e perguntas à Ada, 1 hora; o registro das marcações de interesse usado nos limites, 30 dias; sessões, até 30 dias ou até você sair.",
        "Tickets ficam guardados como histórico do atendimento. Depois que a conta é excluída, eles deixam de estar ligados a ela; para apagá-los também, peça pelo Suporte.",
      ],
    },
    {
      id: "privacy-rights",
      title: "5. Seus direitos",
      paragraphs: [
        "Pela Lei Geral de Proteção de Dados (LGPD), você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade ou a exclusão e obter informações sobre o compartilhamento. Boa parte disso você faz direto no site, em Meu perfil, Dados da empresa e Conta. Para o resto, abra um ticket no Suporte.",
      ],
    },
    {
      id: "privacy-security",
      title: "6. Segurança e cookies",
      paragraphs: [
        "O site usa HTTPS, guarda senhas com hash, limita tentativas de login e mantém a sessão em um cookie protegido, que o JavaScript da página não lê. Esse é o único cookie, e ele é necessário para o login funcionar. O idioma e o tema escolhidos ficam salvos no seu navegador.",
      ],
    },
  ],
  contact: "Dúvidas sobre estes termos ou sobre seus dados?",
  contactLink: "Fale com o Suporte",
};

const en: LegalText = {
  kicker: "Legal",
  title: "Terms of use and privacy",
  sub: "The rules for using StackMatch and how we handle your data, in plain language.",
  updated: "Updated on October 7, 2026.",
  contents: "On this page",
  termsTitle: "Terms of use",
  privacyTitle: "Privacy policy",
  terms: [
    {
      id: "terms-about",
      title: "1. What StackMatch is",
      paragraphs: [
        "StackMatch is a platform where companies discover developers and freelancers, and developers show their skills and projects. By creating an account or using the site, you agree to these terms and to the privacy policy below.",
      ],
    },
    {
      id: "terms-accounts",
      title: "2. Accounts",
      items: [
        "There are two account types, company and developer, chosen at sign-up. You must be at least 18 years old to create an account.",
        "Give true information. Company accounts need a valid CNPJ and a person who speaks for the company.",
        "You are responsible for your password and for what is done with your account. If you suspect someone else got in, change your password in Account and open a ticket in Support.",
      ],
    },
    {
      id: "terms-use",
      title: "3. Acceptable use",
      items: [
        "Companies use contacts and profiles only for hiring or projects, never to send advertising or pass the data on to others.",
        "Fake profiles, impersonating people or companies, offensive or illegal content and copying profiles in bulk with bots are not allowed.",
        "The limits on interests, proposals, e-mails and questions to Ada protect the people using the site. Don't try to get around them.",
      ],
    },
    {
      id: "terms-content",
      title: "4. Your content",
      paragraphs: [
        "What you write and upload (profile, photo, projects, company details, messages) stays yours. You allow StackMatch to show it on the site for the purposes described here, such as showing a published profile to companies. Only upload what you have the right to publish.",
        "A developer's published profile can be opened by anyone with the link.",
      ],
    },
    {
      id: "terms-limits",
      title: "5. What StackMatch doesn't do",
      items: [
        "It doesn't evaluate or certify professionals and doesn't compute any match. Profile information is the responsibility of whoever wrote it.",
        "It doesn't broker contracts, payments or meetings. Proposals and replies go by e-mail between the parties.",
        "It doesn't guarantee hiring, replies or anyone's availability.",
      ],
    },
    {
      id: "terms-ada",
      title: "6. Ada, the AI assistant",
      paragraphs: [
        "Ada is an artificial intelligence, not a person. She answers from a product guide and can make mistakes: check important details on the screens themselves. Don't share passwords, codes or sensitive data with her. When you need a person, open a ticket in Support.",
      ],
    },
    {
      id: "terms-end",
      title: "7. Closing accounts and changes",
      paragraphs: [
        "You can delete your account at any time in Account. We may suspend or delete accounts that break these terms. If the terms change in a meaningful way, we'll say so on the site and update the date at the top of this page.",
      ],
    },
  ],
  privacy: [
    {
      id: "privacy-data",
      title: "1. Data we handle",
      items: [
        "Account: name, e-mail, password (stored only as a hash, never as text), account type, job title and, for companies, company name and CNPJ.",
        "Developer profile: photo, location, seniority, experience, availability, bio, skills, projects and links, plus the automatic translation of the role, bio and project descriptions into the site's other language.",
        "Company details: website, location, description and the contact developers see (name, role, e-mail and phone).",
        "Interactions: saved talent, interest marks, meeting proposals and the messages sent with them.",
        "Ada: the questions and answers of the conversation, kept in your account (Ada only chats with people signed in to an account).",
        "Support: the tickets you open and, if you choose, the conversation with Ada attached to them.",
        "Technical data: IP address, used for security limits (sign-in attempts, e-mails, questions and tickets), and the session cookie.",
      ],
    },
    {
      id: "privacy-purposes",
      title: "2. What we use it for",
      paragraphs: [
        "To provide the service you asked for (performance of a contract): keeping your account, showing profiles, sending interest notices and proposals, answering through Ada and handling tickets. To protect the site and its people (legitimate interest): attempt and sending limits, abuse prevention and investigating problems. We don't sell your data or use it for advertising.",
      ],
    },
    {
      id: "privacy-sharing",
      title: "3. Who we share it with",
      items: [
        "Companies with an account see published profiles. Developers see the contact details of companies that reached out to them.",
        "Vercel: site hosting, image storage and, when turned on, visit counts (without cookies).",
        "Neon: database.",
        "Resend: sending e-mails.",
        "DeepL: translates the free text of profiles and company details (role, bio, descriptions) between Portuguese and English.",
        "Anthropic: processes conversations with Ada to generate the answers.",
        "GitHub: when a profile uses the GitHub avatar, the browser loads the image straight from there.",
        "These providers may process data outside Brazil, with the safeguards the LGPD requires.",
      ],
    },
    {
      id: "privacy-retention",
      title: "4. How long we keep it",
      items: [
        "Account data stays while the account exists. Deleting the account erases the profile, projects, images, company details, saved talent, interests, proposals and the conversation with Ada.",
        "Security records are short-lived: sign-in failures, 15 minutes; code e-mails and questions to Ada, 1 hour; the record of interest marks used by the limits, 30 days; sessions, up to 30 days or until you sign out.",
        "Tickets are kept as the support history. Once the account is deleted, they're no longer linked to it; to erase them too, ask through Support.",
      ],
    },
    {
      id: "privacy-rights",
      title: "5. Your rights",
      paragraphs: [
        "Under Brazil's General Data Protection Law (LGPD), you can confirm whether we handle your data, access it, correct it, ask for portability or deletion and learn who it's shared with. Much of this you can do yourself in My profile, Company details and Account. For the rest, open a ticket in Support.",
      ],
    },
    {
      id: "privacy-security",
      title: "6. Security and cookies",
      paragraphs: [
        "The site uses HTTPS, stores passwords as hashes, limits sign-in attempts and keeps the session in a protected cookie that the page's JavaScript can't read. That is the only cookie, and sign-in needs it. Your language and theme choices are saved in your browser.",
      ],
    },
  ],
  contact: "Questions about these terms or your data?",
  contactLink: "Contact Support",
};

export const legal: Record<Lang, LegalText> = { pt, en };
