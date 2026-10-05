# StackMatch

Protótipo de front-end para descoberta de desenvolvedores e freelancers, criado em aproximadamente uma semana para um processo seletivo.

**O backend está em implementação.** Contas, login, perfis de desenvolvedor, dados da empresa, talentos salvos e interesses já usam o servidor e um banco Postgres; os demais fluxos ainda usam dados fictícios e estado no navegador.

## Problema e proposta

Comparar profissionais exige reunir informações sobre tecnologias, experiência, projetos, disponibilidade e contratação. O StackMatch concentra esses dados em perfis e permite uma primeira seleção por cards, seguida de análise do perfil completo e organização de uma shortlist.

A dinâmica de descoberta sequencial é inspirada em interfaces de swipe, aplicada a um contexto profissional/B2B. O objetivo é facilitar a triagem inicial; o protótipo não avalia automaticamente a qualidade dos profissionais.

## Público inicial

- Pequenas empresas, recrutadores e responsáveis técnicos procurando profissionais para projetos ou contratação.
- Desenvolvedores e freelancers que precisam apresentar habilidades e um mini portfólio.

## Principais funcionalidades

- **Discover:** filtros por tecnologias, senioridade, modelo de trabalho, contratação, disponibilidade e valor máximo por hora. Chips permitem remover seleções. Perfis que já estão nos talentos salvos ficam fora da lista (os salvos durante a rodada continuam até a próxima, para o desfazer funcionar).
- **Ações distintas:** passar avança; salvar adiciona à shortlist; interessado registra interesse separadamente e também salva o perfil. Nenhuma ação envia contato ao profissional.
- **Navegação por cards:** botões e arraste, opção de desfazer e encerramento explícito da lista, com reinício manual.
- **Contas:** telas de entrar, criar conta (empresa ou desenvolvedor) e recuperar senha, com validação por campo, menu da conta no cabeçalho e retorno à página de origem após o login.
- **Acesso por tipo de conta:** Discover e Talentos salvos são exclusivos de empresas; Meu perfil e Empresas interessadas são exclusivos de desenvolvedores. Visitantes são levados ao login (voltando à página depois) e a conta do outro tipo vê um aviso. A página individual de cada perfil continua aberta para links compartilhados. Sem login, o cabeçalho mostra apenas Entrar e Criar conta; com login, só as áreas da conta conectada.
- **Empresas interessadas:** aba do desenvolvedor com as empresas que marcaram interesse no perfil dele pelo Discover ou propuseram uma conversa, com contato, horário sugerido, mensagem e botão para responder por e-mail.
- **Detalhes da empresa:** em Empresas interessadas, o nome da empresa ou o botão "Ver empresa" abre `/company/<id da conta>`, com a descrição, a localização e o site que a empresa preencheu em Dados da empresa, o contato (nome, cargo, e-mail e telefone), o que ela fez (interesse ou proposta) e o botão de resposta. O desenvolvedor só vê empresas que entraram em contato com ele; outros endereços mostram "Empresa não encontrada".
- **Dados da empresa:** página da conta de empresa (`/company-settings`, no menu da conta) com site, localização, descrição e o contato para os desenvolvedores (nome do colaborador, cargo, e-mail e telefone). Propostas de reunião saem assinadas com esse contato, e os interesses marcados no Discover mostram o contato atual da empresa, e as respostas vão para o e-mail de contato. Nome da empresa, CNPJ e e-mail de login aparecem só para consulta. O CNPJ é pedido no cadastro de empresa, com máscara e validação dos dígitos verificadores; a conta `teste.emp` usa o CNPJ de exemplo 11.222.333/0001-81.
- **Contas de teste:** `teste.dev` (desenvolvedor) e `teste.emp` (empresa), ambas com a senha `teste1234`. Entre pelo usuário ou pelo e-mail (`teste.dev@stackmatch.app` / `teste.emp@stackmatch.app`), digitando as credenciais: a tela de login não as exibe. A conta `teste.dev` é o Gabriel Botelho e já vem com o perfil dele publicado. Em deploys públicos, defina `VITE_DEMO_ACCOUNTS=false`: isso deixa de criar as contas de teste no banco e remove o perfil de demonstração do Gabriel, já que a senha fica no código.
- **Perfil completo:** bio, cargo, senioridade, experiência, tecnologias e projetos.
- **Talentos salvos:** cards compactos com dados para consulta, acesso ao perfil e remoção da shortlist. Cada conta de empresa tem a própria shortlist, guardada no servidor (tabela `saved_talents`).
- **Criação de perfil:** formulário em etapas (incluindo anos de experiência, valor por hora e tipos de contratação, usados pelos filtros do Discover), skills, projetos com descrição, tecnologias, imagem de capa, repositório e demo (com edição e remoção), links, preview com o card que as empresas veem no Discover e salvamento no servidor ao concluir.
- **Campos obrigatórios do perfil:** nome, cargo, localização, senioridade, modelo de trabalho, disponibilidade, bio e pelo menos uma skill, marcados com `*`. Com algum em branco, o formulário não avança de etapa nem conclui: mostra a mensagem em cada campo e leva o foco ao primeiro. A regra fica em `missingProfileFields` (`src/lib/local-profile.ts`).
- **Perfil sem projetos:** a etapa Projetos é opcional, com a opção "Continuar sem projetos". Na página do perfil, um desenvolvedor sem projetos mostra um aviso no lugar da seção vazia.
- **Importação simulada do GitHub:** seleção de projetos fictícios para o perfil.
- **Proposta de reunião:** uma conta de empresa sugere um horário (data e hora, em GMT−3) e escreve uma mensagem opcional. O profissional recebe a proposta por e-mail e responde direto para a empresa: o StackMatch não gerencia a reunião nem bloqueia horários. O diálogo mostra uma prévia do e-mail e avisa quando já houve proposta para o mesmo profissional. Visitantes são levados ao login; contas de desenvolvedor não enviam propostas.
- **Assistente (prévia):** chat flutuante com sugestões, digitação em streaming e opção de parar a resposta, pronto para conectar a um backend de IA.
- **PT-BR e EN**, interface responsiva e ajustes de acessibilidade, incluindo labels, estados de seleção e respeito à preferência por movimento reduzido nos cards.

## Stack utilizada

- React 19 e TypeScript em modo estrito.
- TanStack Start e TanStack Router para estrutura da aplicação e rotas por arquivos.
- Vite 8, com Nitro gerando o servidor para o deploy (a Vercel é detectada automaticamente).
- Tailwind CSS 4 e componentes baseados em Radix UI.
- Framer Motion para animações e arraste dos cards.
- Lucide para ícones e Sonner para notificações.
- date-fns e React DayPicker para datas e calendário.
- Drizzle ORM com Postgres (Neon em produção, PGlite no desenvolvimento e nos testes) e server functions do TanStack Start para o backend.
- Zod e React Hook Form para validação dos formulários e da estrutura dos dados locais.
- TanStack Query para as consultas à API simulada (catálogo, atividade das empresas, dados e perfil das empresas), com estados de carregamento e erro.
- ESLint e Prettier para verificação e formatação.
- Vitest e Playwright para os testes.

## Como executar

Pré-requisitos: Node.js 22.12 ou superior e npm.

Na pasta do repositório:

```sh
npm install
npm run dev
```

Acesse o endereço informado pelo Vite no terminal. Sem configuração, o servidor usa um Postgres local em arquivo (PGlite, na pasta `.pglite/`, criado e migrado sozinho); para começar do zero, apague essa pasta. Os fluxos mockados não exigem credenciais de GitHub ou Google Calendar.

### Banco de dados

- `DATABASE_URL` define o banco: uma URL `postgres://…` (Neon em produção), `memory://` para um banco descartável ou o caminho de uma pasta do PGlite. Em produção ela é obrigatória.
- O schema fica em `src/server/db/schema.ts`. Depois de alterá-lo, gere a migração com `npm run db:generate`; para aplicar as migrações num Postgres, rode `npm run db:migrate` com `DATABASE_URL` definida.

### Verificações

```sh
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Os testes de interface (Playwright) sobem o servidor de desenvolvimento sozinhos, com banco em memória, e rodam um de cada vez: antes de cada teste, o banco volta aos dados de demonstração pela rota `/api/test-reset`, e alguns testes preparam a shortlist pela `/api/test-seed`; as duas só existem com `E2E=1`. Se já houver um servidor na porta 5299, ele é reaproveitado e o reset falha; encerre-o antes. Os testes usam o Google Chrome instalado na máquina. Onde ele não existir, rode `npx playwright install chrome` antes. Eles cobrem cadastro, login e recuperação de senha; acesso por tipo de conta; Discover (ações, desfazer, filtros e shortlist separada por empresa); perfil (links reais e de demonstração, avatar do GitHub e fallback); criação de perfil com campos obrigatórios e sem projetos; Empresas interessadas e detalhes da empresa; idioma e tema; assistente; proposta de reunião; e o layout em celular.

Para rodar o build de produção localmente, use o servidor gerado pelo Nitro (o `npm run preview` procura o build em `dist/` e não funciona com essa configuração):

```sh
npm run build
node .output/server/index.mjs
```

O servidor usa a porta 3000; para outra, defina `PORT`.

O lint pode apresentar avisos de `react-refresh/only-export-components` em módulos que exportam componentes junto com funções ou constantes. Eles se referem ao Fast Refresh em desenvolvimento.

## Arquitetura em alto nível

| Local                          | Responsabilidade                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`                  | Páginas: início, login, cadastro, Discover, perfil, talentos salvos, criação de perfil, empresas interessadas, detalhes e dados da empresa. |
| `src/components/`              | Componentes de produto, como cards, filtros, cabeçalho e proposta de reunião.                                                               |
| `src/components/ui/`           | Primitivas reutilizáveis de interface (só as usadas pelo app).                                                                              |
| `src/lib/api.ts`               | API simulada: único ponto a trocar por chamadas ao backend.                                                                                 |
| `src/lib/auth.ts`              | Tipos de conta, validação de cadastro e contas de teste.                                                                                    |
| `src/lib/auth-api.ts`          | Server functions de cadastro, login, logout e conta atual.                                                                                  |
| `src/server/`                  | Código só de servidor: banco (`db/`), senhas, sessões e contas de teste.                                                                    |
| `src/lib/developers.ts`        | Tipos e catálogo mockado de profissionais, projetos e empresas de demonstração.                                                             |
| `src/lib/app-context.tsx`      | Estado compartilhado: shortlist e interesses da empresa (sincronizados com o servidor) e propostas enviadas.                                |
| `src/lib/interests-api.ts`     | Server functions de interesse: marcar, desfazer, os marcados pela empresa e os recebidos pelo desenvolvedor.                                |
| `src/lib/saved-talents-api.ts` | Server functions da shortlist: listar, salvar e remover.                                                                                    |
| `src/lib/meeting-requests.ts`  | Formato das propostas de reunião, horários aceitos e leitura do histórico local.                                                            |
| `src/lib/profile-interests.ts` | Formato das marcações de interesse e agrupamento das empresas interessadas por conta.                                                       |
| `src/lib/company-settings.ts`  | Validação dos dados da empresa e o perfil público que o desenvolvedor vê.                                                                   |
| `src/lib/company-api.ts`       | Server functions dos dados da empresa e do perfil público dela.                                                                             |
| `src/lib/local-profile.ts`     | Estrutura e campos obrigatórios do perfil e validação usada pelo servidor.                                                                  |
| `src/lib/profile-api.ts`       | Server functions de perfil: o próprio (ler e salvar) e os publicados.                                                                       |
| `src/lib/i18n.tsx`             | Dicionários, idioma ativo e formatação de valores.                                                                                          |
| `src/styles.css`               | Estilos globais e tokens visuais.                                                                                                           |

Estados transitórios, como filtros, etapa do formulário e posição na lista, ficam nos componentes. Os dados compartilhados usam Context; propostas enviadas e preferência de idioma usam `localStorage`. Contas, perfis, dados da empresa, shortlist e interesses ficam no servidor; shortlist e interesses mudam na tela na hora, as alterações vão ao servidor uma de cada vez, e a lista volta ao que o servidor tem se ele recusar alguma.

Embora TanStack Start tenha infraestrutura de renderização no servidor, não há backend de negócio, banco de dados ou API de contratação implementados.

## PT-BR / EN

O seletor no cabeçalho alterna entre português brasileiro e inglês e guarda a preferência no navegador. Os textos ficam em dicionários tipados em `src/lib/i18n.tsx`.

Os valores dos mocks são traduzidos na apresentação, preservando os dados usados pelos filtros. Datas seguem o idioma selecionado; preços permanecem em **BRL**, sem conversão cambial. Os horários propostos usam o horário de Brasília (GMT−3).

## O que está mockado

- Os dezesseis profissionais do catálogo, suas bios, projetos, valores, experiências e disponibilidades são fictícios; com o perfil da conta `teste.dev`, o Discover mostra 17. A home não faz alegações de volume ou verificação de perfis.
- As empresas da atividade de demonstração (NuvemPay, Órbita Labs e VerdeTech) têm descrição, cidade, site de exemplo e cargo do contato fictícios (`demoCompanyProfiles` em `src/lib/developers.ts`). `fetchCompanyProfile` em `src/lib/company-api.ts` devolve esses dados ou o que uma conta de empresa salvou em Dados da empresa (tabela `company_profiles`), e só responde a contas de desenvolvedor. Ainda não confere se a empresa contatou esse desenvolvedor: isso depende de as propostas também irem para o servidor.
- A importação do GitHub é uma **simulação de front-end**, sem OAuth ou consulta a repositórios reais.
- O envio da proposta de reunião é **simulado**: `sendMeetingRequest` em `src/lib/api.ts` faz o papel do futuro `POST /meeting-requests`, que enviará o e-mail ao profissional com `Reply-To` da empresa. Nenhum e-mail é enviado; a proposta fica registrada neste navegador para a empresa lembrar com quem já falou.
- O interesse fica no banco (tabela `interests`, um por empresa e desenvolvedor), sem notificação, chat ou contato externo, e aparece para o desenvolvedor em Empresas interessadas com o contato atual da empresa. Desfazer no Discover apaga o interesse. Interesses salvos no navegador por versões anteriores são descartados.
- **Contas e login usam o servidor.** O cadastro e a entrada gravam no banco (tabela `users`), com a senha em hash scrypt, e abrem uma sessão guardada num cookie httpOnly (o banco guarda só o hash do token, tabela `sessions`, com validade de 30 dias). A recuperação de senha ainda é simulada: nenhum e-mail é enviado. Há dois tipos de conta: **empresa** (com nome da empresa e CNPJ; entra pelo Discover) e **desenvolvedor** (com cargo profissional; entra pelo formulário de perfil, já preenchido).
- **Controle de acesso:** o guard `RequireAccount` (`src/components/require-account.tsx`) organiza a interface, e as server functions conferem o tipo de conta (`requireAccount` em `src/server/session.ts`). As propostas de reunião, ainda no navegador, são a exceção. Interesses são associados ao perfil pelo id da conta do desenvolvedor; `fetchCompanyActivity` em `src/lib/api.ts` devolve a atividade fictícia (de `src/lib/developers.ts`) apenas para a conta `teste.dev`. As contas de teste ficam em `src/lib/auth.ts` e são criadas no banco ao iniciar.
- Propostas e interesses guardam o id da conta da empresa (`companyId`), que identifica quem já contatou cada profissional mesmo se a empresa trocar o e-mail de contato. Propostas antigas, sem esse campo, usam o e-mail no lugar.
- Os dados da empresa ficam no banco (tabela `company_profiles`), um registro por conta de empresa, lidos e salvos só pela própria conta. Até a empresa salvar, valem o nome, o cargo e o e-mail do cadastro. Dados salvos no navegador por versões anteriores não são migrados.
- O assistente responde com uma mensagem simulada enquanto `VITE_ASSISTANT_API_URL` não estiver definida.
- Os links de GitHub, LinkedIn e demos dos perfis mockados usam endereços de exemplo: ao clicar, um aviso mostra o endereço sem navegar, já que essas URLs podem pertencer a pessoas reais. Links válidos preenchidos no perfil local podem ser abertos pelo usuário.
- O perfil do Gabriel Botelho é o perfil da conta `teste.dev` (`demoDeveloperProfile` em `src/lib/developers.ts`), gravado no banco quando ele começa sem esse perfil; depois, valem as edições da conta. Ele usa links reais, que abrem em nova aba, e a foto vem do avatar público do GitHub (`github.com/<usuário>.png`). O perfil criado no app também usa esse avatar quando o GitHub é preenchido; se a imagem não carregar, aparecem as iniciais.
- O resumo do profissional exibe seus dados; não existe percentual calculado de matching.

## Assistente com IA (preparado para backend)

O botão no canto inferior direito abre o chat do assistente. Sem backend, ele usa respostas simuladas e avisa que a IA ainda não está conectada.

Para conectar, defina a URL do serviço em um arquivo `.env.local`:

```sh
VITE_ASSISTANT_API_URL=https://api.exemplo.com/assistant
```

O front envia um `POST` com JSON:

```json
{
  "messages": [{ "role": "user", "content": "Como funciona o Discover?" }],
  "locale": "pt-BR",
  "context": { "pathname": "/discover" }
}
```

A resposta pode ser texto em streaming (`text/plain`, exibido conforme chega) ou JSON no formato `{ "reply": "..." }`. O botão de parar cancela a requisição via `AbortSignal`. O contrato e os transports ficam em `src/lib/assistant.ts`; a interface, em `src/components/assistant-widget.tsx`.

## Analytics de visitas (Vercel)

O projeto inclui o [Vercel Analytics](https://vercel.com/docs/analytics), desativado por padrão. Ele só coleta dados quando o site está hospedado na Vercel; em outros hosts, o script de coleta não existe.

Para ativar em um deploy na Vercel:

1. Habilite o Analytics no painel do projeto na Vercel.
2. Defina a variável de ambiente `VITE_VERCEL_ANALYTICS=true` e faça um novo deploy.

Sem essa variável, o componente não é incluído no build.

## Decisões técnicas

- **Mocks centralizados:** manter o catálogo em um módulo reduz os pontos de alteração quando houver uma fonte real de dados.
- **Context e estado local:** atendem ao volume e ao escopo do protótipo sem introduzir uma camada adicional de gerenciamento de estado.
- **Persistência no navegador:** permite demonstrar continuidade entre visitas sem infraestrutura externa.
- **Filtros determinísticos:** opções do mesmo grupo usam OU; grupos diferentes usam E. O filtro de disponibilidade corresponde ao status selecionado.
- **Ações separadas:** shortlist e interesse têm registros distintos, evitando confundir organização de candidatos com intenção de contato.
- **Componentes compartilhados:** cards, controles e diálogos mantêm padrões de interação entre telas.
- **Escopo explícito:** integrações ausentes são apresentadas como simulações ou ações indisponíveis.

## Limitações conhecidas

- Contas, perfis de desenvolvedor, dados da empresa, shortlist e interesses ficam no servidor, que confere o tipo de conta antes de ler ou salvar. As propostas ainda ficam no navegador, e o tipo de conta ainda não é verificado nesses fluxos. Limpar os dados do navegador apaga esses registros. Não há verificação de profissionais.
- A proposta de reunião não consulta a agenda do profissional; confirmar ou remarcar acontece por e-mail, fora do app.
- Os perfis de desenvolvedor ficam no banco (tabelas `developer_profiles`, `skills`, `developer_skills`, `projects` e `project_skills`), um por conta e identificados pelo id dela. Cada conta edita só o próprio perfil, e o Discover lista os de todas as contas de desenvolvedor, antes do catálogo fictício. Para empresas, cada um é um candidato como os outros, com página em `/developer/<id da conta>` no mesmo formato dos demais; o selo "Seu perfil" aparece só para o dono. Perfis que deixam valor por hora ou tipo de contratação em branco saem da lista quando esses filtros estão ativos. As imagens de capa dos projetos são reduzidas no navegador e, por enquanto, gravadas no banco como data URL; o próximo passo é um armazenamento de arquivos. Perfis salvos no navegador por versões anteriores não são migrados.
- O catálogo é pequeno e estático; algumas opções de filtro podem não retornar resultados. Não há busca geográfica, ranking ou recomendação automática.
- As imagens de perfil incluem reutilizações entre personagens fictícios; os perfis adicionados por último não têm foto e mostram as iniciais.
- Shortlists salvas no navegador por versões anteriores não são migradas para o servidor. A shortlist só aceita perfis que existem (do catálogo ou de contas de desenvolvedor); se um perfil deixar de existir, ele some da lista e do contador.
- Filtros, posição na descoberta e histórico de desfazer não persistem entre sessões. O formulário guarda seu conteúdo em estado durante a edição e persiste ao concluir.
- Acessibilidade e responsividade receberam ajustes pontuais; ainda cabe uma validação mais ampla com usuários, leitores de tela e diferentes dispositivos.
- Os testes automatizados cobrem a lógica (Vitest, `npm test`) e os principais fluxos no navegador (Playwright, `npm run test:e2e`).

## Próximos passos

1. Validar com contratantes e desenvolvedores se os dados dos cards são suficientes para a triagem inicial.
2. Definir uma regra de compatibilidade entre vaga e perfil, para que o "match" do produto seja calculado.
3. Rodar as suítes automaticamente a cada push (CI).
4. Em uma etapa com backend, definir contratos de API, autenticação, publicação de perfis e persistência por usuário.
5. Mostrar o status das propostas de reunião para os dois lados (enviada, vista, respondida).
6. Integrar o GitHub e o envio de e-mails apenas após definir permissões, privacidade e limites contra spam nas propostas de reunião.
