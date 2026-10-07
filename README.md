# StackMatch

Protótipo de front-end para descoberta de desenvolvedores e freelancers, criado em aproximadamente uma semana para um processo seletivo.

**Backend com Postgres.** Todos os dados vêm do banco: contas, perfis, dados da empresa, talentos salvos, interesses e propostas de reunião. Não há dados fictícios no código, a não ser o card de exemplo da home, que ilustra o produto com uma pessoa fictícia; um banco novo começa com o seed (`npm run db:seed`). Os e-mails saem pelo Resend; o assistente de suporte responde com o Claude, da Anthropic, quando a chave da API está configurada.

## Problema e proposta

Comparar profissionais exige reunir informações sobre tecnologias, experiência, projetos, disponibilidade e contratação. O StackMatch concentra esses dados em perfis e permite uma primeira seleção por cards, seguida de análise do perfil completo e organização de uma shortlist.

A dinâmica de descoberta sequencial é inspirada em interfaces de swipe, aplicada a um contexto profissional/B2B. O objetivo é facilitar a triagem inicial; o protótipo não avalia automaticamente a qualidade dos profissionais.

## Público inicial

- Pequenas empresas, recrutadores e responsáveis técnicos procurando profissionais para projetos ou contratação.
- Desenvolvedores e freelancers que precisam apresentar habilidades e um mini portfólio.

## Principais funcionalidades

- **Discover:** filtros por tecnologias, senioridade, modelo de trabalho, contratação, disponibilidade e valor máximo por hora. Chips permitem remover seleções. Perfis que já estão nos talentos salvos ficam fora da lista (os salvos durante a rodada continuam até a próxima, para o desfazer funcionar). O servidor aplica os filtros e manda os perfis 20 de cada vez; a página seguinte é pedida perto do fim das que já chegaram.
- **Ações distintas:** passar avança; salvar adiciona à shortlist; interessado registra interesse separadamente, também salva o perfil e avisa o profissional por e-mail (no máximo uma vez a cada 30 dias por empresa, mesmo marcando, desfazendo e marcando de novo). Passar e salvar não avisam ninguém.
- **Navegação por cards:** botões e arraste, opção de desfazer e encerramento explícito da lista, com reinício manual.
- **Contas:** telas de entrar, criar conta (empresa ou desenvolvedor) e recuperar senha, com validação por campo, menu da conta no cabeçalho e retorno à página de origem após o login.
- **Conta** (`/account`, no menu da conta): trocar o e-mail (com um código enviado ao endereço novo; o antigo recebe um aviso), trocar a senha (as outras sessões são encerradas) e excluir a conta, o que apaga também perfil, projetos, dados da empresa, talentos salvos, interesses, propostas e as imagens no armazenamento. Cada ação pede a senha atual, e uma senha errada conta para o limite de tentativas de login. Com `SUPPORT_EMAIL` definida, o aviso de troca de e-mail leva o endereço de suporte para resposta, e os tickets chegam nesse endereço.
- **Limite de tentativas no login:** 5 senhas erradas para o mesmo e-mail em 15 minutos bloqueiam o login desse e-mail, mesmo com a senha certa, até a falha mais antiga sair da janela; 20 falhas do mesmo IP em 15 minutos, em qualquer conta, bloqueiam o IP. A tela diz quantos minutos faltam. E-mails sem conta também contam, para o bloqueio não revelar quais estão cadastrados. Entrar com sucesso ou redefinir a senha libera o e-mail. As falhas ficam na tabela `login_failures` (`src/server/login-throttle.ts`).
- **Limite de e-mails por rede:** cada IP pode causar até 20 e-mails com código (confirmação, recuperação de senha, troca de e-mail) por hora, em qualquer conta, além da espera de 1 minuto entre códigos de cada conta. Passando disso, o cadastro e os pedidos de código esperam, e a tela diz quanto tempo falta. Assim ninguém cria contas ou pede códigos em massa para gastar a cota do Resend e a reputação do domínio. A recuperação de senha confere o limite antes de procurar o e-mail, então continua sem revelar quais estão cadastrados. Os envios ficam na tabela `email_sends` (`src/server/email-throttle.ts`).
- **Confirmação de e-mail:** depois do cadastro, a conta recebe um código de 6 dígitos por e-mail e só passa a usar o app depois de digitá-lo na tela de confirmação (`/verify-email`). Até lá, as páginas da conta levam para essa tela e o servidor recusa as ações dela. O código vale por 15 minutos, aceita até 5 tentativas e pode ser reenviado a cada minuto. Entrar com uma conta não confirmada envia um código novo.
- **Recuperação de senha:** a pessoa informa o e-mail, recebe um código e define a nova senha na mesma tela; as sessões abertas da conta são encerradas. A tela responde igual exista ou não a conta, e um código para um e-mail sem conta falha como um código errado.
- **Acesso por tipo de conta:** Discover e Talentos salvos são exclusivos de empresas; Meu perfil e Empresas interessadas são exclusivos de desenvolvedores. Visitantes são levados ao login (voltando à página depois) e a conta do outro tipo vê um aviso. A página individual de cada perfil continua aberta para links compartilhados. Sem login, o cabeçalho mostra apenas Entrar e Criar conta; com login, só as áreas da conta conectada.
- **Empresas interessadas:** aba do desenvolvedor com as empresas que marcaram interesse no perfil dele pelo Discover ou propuseram uma conversa, com contato, horário sugerido, mensagem e botão para responder por e-mail.
- **Detalhes da empresa:** em Empresas interessadas, o nome da empresa ou o botão "Ver empresa" abre `/company/<id da conta>`, com a descrição, a localização e o site que a empresa preencheu em Dados da empresa, o contato (nome, cargo, e-mail e telefone), o que ela fez (interesse ou proposta) e o botão de resposta. O desenvolvedor só vê empresas que entraram em contato com ele, o que o servidor também confere; outros endereços mostram "Empresa não encontrada".
- **Dados da empresa:** página da conta de empresa (`/company-settings`, no menu da conta) com site, localização, descrição e o contato para os desenvolvedores (nome do colaborador, cargo, e-mail e telefone). Propostas de reunião saem assinadas com esse contato, os interesses marcados no Discover mostram o contato atual da empresa, e as respostas vão para o e-mail de contato. Nome da empresa, CNPJ e e-mail de login aparecem só para consulta. O CNPJ é pedido no cadastro de empresa, com máscara e validação dos dígitos verificadores; a conta de teste da empresa usa o CNPJ de exemplo 11.222.333/0001-81.
- **Contas de teste:** o seed (`npm run db:seed`) cria `teste.dev@example.com` (desenvolvedor, com o perfil do Gabriel Botelho publicado) e `teste.emp@example.com` (empresa), ambas com a senha `teste1234`. O login é sempre pelo e-mail, e a tela de login não mostra essas contas. Como a senha está no código, rode o seed só nos bancos em que essas contas devem existir.
- **Perfil completo:** bio, cargo, senioridade, experiência, tecnologias e projetos.
- **Talentos salvos:** cards compactos com dados para consulta, acesso ao perfil e remoção da shortlist. Cada conta de empresa tem a própria shortlist, guardada no servidor (tabela `saved_talents`).
- **Criação de perfil:** formulário em etapas (incluindo foto do perfil, localização, anos de experiência, valor por hora e tipos de contratação, usados pelos filtros do Discover), skills com sugestões, projetos com descrição, tecnologias, imagem de capa, repositório e demo (com edição e remoção), links, preview com o card que as empresas veem no Discover e salvamento no servidor ao concluir.
- **Sugestões de skills:** ao digitar uma skill, o campo sugere as do catálogo de referência (cerca de 220, de desenvolvimento a infraestrutura, segurança, design e gestão) e as que já estão em uso em perfis e projetos, das mais usadas para as menos usadas e depois por nome, e navega com as setas. Se nenhuma servir, o que foi digitado entra como skill nova e, quando o perfil é salvo, passa a ser sugerida para os outros. A mesma skill com outra grafia ("react") usa a que já existe ("React"), no formulário e no servidor.
- **Localização:** o desenvolvedor escolhe o estado e, em seguida, a cidade, de uma lista carregada da [API de localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades) (guardada em cache por um dia). O perfil grava `Cidade, UF`, e o servidor recusa outro formato. Uma localização antiga em texto livre continua aparecendo até ser trocada.
- **Campos obrigatórios do perfil:** nome, cargo, localização, senioridade, modelo de trabalho, disponibilidade, bio e pelo menos uma skill, marcados com `*`. Com algum em branco, o formulário não avança de etapa nem conclui: mostra a mensagem em cada campo e leva o foco ao primeiro. A regra fica em `missingProfileFields` (`src/lib/local-profile.ts`).
- **Perfil sem projetos:** a etapa Projetos é opcional, com a opção "Continuar sem projetos". Na página do perfil, um desenvolvedor sem projetos mostra um aviso no lugar da seção vazia.
- **Proposta de reunião:** uma conta de empresa sugere um horário (data e hora, em GMT−3) e escreve uma mensagem opcional. O profissional recebe a proposta por e-mail, com o mesmo texto da prévia que o diálogo mostra, e responde direto para a empresa (`Reply-To` com o contato dela): o StackMatch não gerencia a reunião nem bloqueia horários. Se o e-mail não puder ser enviado, a proposta não é registrada e a empresa vê o erro. O diálogo avisa quando já houve proposta para o mesmo profissional. Visitantes são levados ao login; contas de desenvolvedor não enviam propostas.
- **Assistente de suporte:** a Ada, chat flutuante com sugestões, resposta em streaming e opção de parar, que tira dúvidas sobre o uso do StackMatch com o Claude (detalhes em [Assistente de suporte com IA](#assistente-de-suporte-com-ia)).
- **Suporte** (`/support`, no menu da conta, no rodapé e no chat): formulário de ticket com assunto (problema ou bug, conta e acesso, dúvida, sugestão, outro), título e mensagem. Visitantes informam nome e e-mail; contas com login recebem a resposta no e-mail da conta, podem anexar a conversa com a Ada e veem os próprios tickets com número, status e data. O ticket fica na tabela `support_tickets` e vai por e-mail para `SUPPORT_EMAIL`, com `Reply-To` de quem abriu, para a equipe responder da caixa de entrada; contas confirmadas recebem um recibo (visitantes não, para o formulário não mandar e-mail a endereços de terceiros). Uma falha no e-mail vai para o log e não perde o ticket. Cada IP e cada conta abrem até 5 tickets por hora (`src/server/support.ts`). A equipe fecha e reabre os tickets no painel de administração. Ao excluir a conta, os tickets dela ficam sem o vínculo.
- **Painel de tickets** (`/admin/tickets`, no menu da conta de quem é admin): lista os tickets abertos, resolvidos ou todos, com as contagens, o autor (nome, e-mail e tipo de conta ou visitante), a mensagem e a conversa com a Ada anexada. Cada ticket tem um botão para responder por e-mail (abre o programa de e-mail com o assunto `Re: [Ticket #N] ...`) e outro para marcar como resolvido ou reabrir; o ticket guarda quando e por quem foi resolvido, e o autor vê o status novo em Suporte. Ao ser resolvido, o ticket manda um e-mail a quem o abriu, no idioma em que foi escrito, com `Reply-To` para `SUPPORT_EMAIL` e, para contas, um link para a lista de tickets. O aviso sai uma vez só: resolver de novo ou reabrir não manda outro, e se o e-mail falhar o ticket fica resolvido e o painel avisa. Admins são as contas confirmadas cujo e-mail está em `ADMIN_EMAILS` (separados por vírgula); não há papel de admin no banco, e o servidor confere a lista em cada ação (`src/server/admin.ts`). Outras contas veem "Área restrita". Mostra os 200 tickets mais recentes de cada filtro.
- **Termos de uso e privacidade** (`/terms`, no rodapé e no cadastro, onde abre em nova aba): termos e política de privacidade em PT-BR e EN, em `src/lib/legal.ts`. O texto descreve o que o app faz de fato (dados, fornecedores, prazos de retenção, direitos da LGPD); ao mudar uma dessas coisas, atualize-o também. Ele não substitui a revisão de um advogado nem identifica a pessoa jurídica responsável.
- **Tradução automática** (`src/server/translations.ts`): ao salvar o perfil ou os dados da empresa, os textos livres (cargo, bio e descrições dos projetos; descrição da empresa e cargo do contato) são traduzidos entre português e inglês pela [DeepL](https://www.deepl.com/pro-api) (`DEEPL_API_KEY`; o plano Free dá 500 mil caracteres por mês, e chaves terminadas em `:fx` usam a API Free), com o Claude (`ANTHROPIC_API_KEY`) como reserva quando a DeepL falha ou a cota do mês acaba (com só uma das chaves, ela traduz sozinha). Cada texto ganha o outro idioma, qualquer que seja o idioma em que foi escrito, e aparece no idioma escolhido no cabeçalho (`tv(texto, traduções)` em `src/lib/i18n.tsx`). Abaixo do texto traduzido, a página do perfil e a da empresa dizem que ele foi traduzido com IA e têm um botão para ver o original. As traduções ficam na tabela `text_translations`, ligadas à conta e ao hash do texto original: só textos novos ou alterados são traduzidos, as de textos que saíram do perfil são apagadas, e excluir a conta apaga todas. O salvamento espera a tradução (até 30 segundos); se a tradução falhar ou não houver nenhuma das chaves, o perfil salva normalmente e os textos aparecem como foram escritos. Skills, nomes, links e nomes de projetos não são traduzidos. Para traduzir os perfis salvos antes deste recurso, rode `npm run translations:backfill` (lê `DATABASE_URL`, `DEEPL_API_KEY` e `ANTHROPIC_API_KEY` do ambiente ou do `.env.migrate.local`).
- **Rodapé:** em todas as páginas, com os links de Suporte e de Termos.
- **PT-BR e EN**, interface responsiva e ajustes de acessibilidade, incluindo labels, estados de seleção e respeito à preferência por movimento reduzido nos cards.

## Stack utilizada

- React 19 e TypeScript em modo estrito.
- TanStack Start e TanStack Router para estrutura da aplicação e rotas por arquivos.
- Vite 8, com Nitro gerando o servidor para o deploy (a Vercel é detectada automaticamente).
- Tailwind CSS 4 e componentes baseados em Radix UI.
- Framer Motion para animações e arraste dos cards.
- Lucide para ícones e Sonner para notificações.
- date-fns e React DayPicker para datas e calendário.
- SDK da Anthropic (`@anthropic-ai/sdk`) para o assistente de suporte.
- Drizzle ORM com Postgres (Neon em produção, PGlite no desenvolvimento e nos testes) e server functions do TanStack Start para o backend.
- Zod e React Hook Form para validação dos formulários e da estrutura dos dados locais.
- TanStack Query para as consultas às server functions, com estados de carregamento e erro.
- ESLint e Prettier para verificação e formatação.
- Vitest e Playwright para os testes.

## Como executar

Pré-requisitos: Node.js 22.12 ou superior e npm.

Na pasta do repositório:

```sh
npm install
npm run dev
```

Acesse o endereço informado pelo Vite no terminal. Sem configuração, o servidor usa um Postgres local em arquivo (PGlite, na pasta `.pglite/`, criado e migrado sozinho); para começar do zero, apague essa pasta. Um banco novo começa vazio: rode `npm run db:seed` para criar as contas de teste (com o servidor de desenvolvimento parado, porque o PGlite só aceita um processo por vez).

### Banco de dados

- `DATABASE_URL` define o banco: uma URL `postgres://…` (Neon em produção), `memory://` para um banco descartável ou o caminho de uma pasta do PGlite. Em produção ela é obrigatória.
- O schema fica em `src/server/db/schema.ts`. Depois de alterá-lo, gere a migração com `npm run db:generate` e faça commit da pasta `drizzle/`. No deploy de produção, a Vercel aplica as migrações pendentes antes de montar o site (`npm run vercel-build`, que pula previews); se uma falhar, o deploy falha e o site fica na versão anterior. `npm run db:migrate` aplica as migrações à mão, com a `DATABASE_URL` do ambiente ou do `.env.migrate.local` (veja `.env.example`). Não coloque a `DATABASE_URL` no `.env` nem no `.env.local`: o servidor de desenvolvimento carrega esses arquivos e deixaria de usar o PGlite.
- `npm run db:seed` adiciona as contas de teste e o perfil do Gabriel ao banco da `DATABASE_URL` (lida do `.env.migrate.local`, como no `db:migrate`) ou ao PGlite local. O que já existe não é alterado.
- Configuração do Neon na Vercel, passo a passo: [docs/deploy-neon.md](docs/deploy-neon.md).

### Verificações

```sh
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

O GitHub Actions roda essas verificações a cada push no `main` e a cada pull request (`.github/workflows/ci.yml`): um job com lint, tipos, testes unitários e build, e outro com os testes de interface. Nenhum segredo é necessário. Quando um teste de interface falha, o trace dele fica como artefato da execução por 7 dias.

Os testes de interface (Playwright) sobem o servidor de desenvolvimento sozinhos, com banco em memória, e rodam um de cada vez: antes de cada teste, o banco volta ao seed pela rota `/api/test-reset` e recebe os dados de teste de `e2e/test-data.ts` (quatro desenvolvedores e três empresas que contataram o Gabriel) pela `/api/test-seed`; as duas só existem com `E2E=1`. Se já houver um servidor na porta 5299, ele é reaproveitado e o reset falha; encerre-o antes. Os testes usam o Google Chrome instalado na máquina. Onde ele não existir, rode `npx playwright install chrome` antes. Eles cobrem cadastro com confirmação de e-mail, login e recuperação de senha (lendo os códigos pela rota `/api/test-emails`, que também só existe com `E2E=1`); acesso por tipo de conta; Discover (ações, desfazer, filtros, shortlist separada por empresa e carregamento em páginas); perfil (links, avatar do GitHub e fallback); criação de perfil com campos obrigatórios e sem projetos; Empresas interessadas e detalhes da empresa; idioma e tema; assistente; proposta de reunião; e o layout em celular.

Para rodar o build de produção localmente, use o servidor gerado pelo Nitro (o `npm run preview` procura o build em `dist/` e não funciona com essa configuração):

```sh
npm run build
node .output/server/index.mjs
```

O servidor usa a porta 3000; para outra, defina `PORT`.

O lint pode apresentar avisos de `react-refresh/only-export-components` em módulos que exportam componentes junto com funções ou constantes. Eles se referem ao Fast Refresh em desenvolvimento.

## Arquitetura em alto nível

| Local                          | Responsabilidade                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`                  | Páginas: início, login, cadastro, Discover, perfil, talentos salvos, criação de perfil, empresas interessadas, detalhes e dados da empresa, suporte e termos. |
| `src/components/`              | Componentes de produto, como cards, filtros, cabeçalho e proposta de reunião.                                                                                 |
| `src/components/ui/`           | Primitivas reutilizáveis de interface (só as usadas pelo app).                                                                                                |
| `src/lib/auth.ts`              | Tipos de conta e validação de cadastro e login.                                                                                                               |
| `src/lib/auth-api.ts`          | Server functions de cadastro, login, logout e conta atual.                                                                                                    |
| `src/server/`                  | Código só de servidor: banco (`db/`), senhas, sessões, regras de cada tabela e o seed.                                                                        |
| `src/lib/developers.ts`        | Tipo do perfil publicado, opções dos filtros e avatar do GitHub.                                                                                              |
| `src/lib/app-context.tsx`      | Estado compartilhado: shortlist e interesses da empresa, sincronizados com o servidor.                                                                        |
| `src/lib/meetings-api.ts`      | Server functions das propostas: enviar, as enviadas pela empresa e as recebidas pelo desenvolvedor.                                                           |
| `src/lib/interests-api.ts`     | Server functions de interesse: marcar, desfazer, os marcados pela empresa e os recebidos pelo desenvolvedor.                                                  |
| `src/lib/saved-talents-api.ts` | Server functions da shortlist: listar, salvar e remover.                                                                                                      |
| `src/lib/meeting-requests.ts`  | Formato das propostas de reunião e horários aceitos.                                                                                                          |
| `src/lib/profile-interests.ts` | Formato das marcações de interesse e agrupamento das empresas interessadas por conta.                                                                         |
| `src/lib/company-settings.ts`  | Validação dos dados da empresa e o perfil público que o desenvolvedor vê.                                                                                     |
| `src/lib/company-api.ts`       | Server functions dos dados da empresa e do perfil público dela.                                                                                               |
| `src/lib/local-profile.ts`     | Estrutura e campos obrigatórios do perfil e validação usada pelo servidor.                                                                                    |
| `src/lib/profile-api.ts`       | Server functions de perfil: o próprio (ler e salvar) e os publicados.                                                                                         |
| `src/lib/i18n.tsx`             | Dicionários, idioma ativo e formatação de valores.                                                                                                            |
| `src/styles.css`               | Estilos globais e tokens visuais.                                                                                                                             |

Estados transitórios, como filtros, etapa do formulário e posição na lista, ficam nos componentes. Os dados compartilhados usam Context e TanStack Query; só a preferência de idioma e o tema usam `localStorage`. Contas, perfis, dados da empresa, shortlist, interesses e propostas ficam no servidor; shortlist e interesses mudam na tela na hora, as alterações vão ao servidor uma de cada vez, e a lista volta ao que o servidor tem se ele recusar alguma.

## PT-BR / EN

O seletor no cabeçalho alterna entre português brasileiro e inglês e guarda a preferência no navegador. Os textos ficam em dicionários tipados em `src/lib/i18n.tsx`.

As opções do perfil (senioridade, modelo de trabalho, disponibilidade e contratação) ficam em português no banco e são traduzidas na tela, preservando os valores usados pelos filtros. O que cada pessoa escreve aparece como foi escrito. Datas seguem o idioma selecionado; preços permanecem em **BRL**, sem conversão cambial. Os horários propostos usam o horário de Brasília (GMT−3).

## Dados e regras no servidor

- **Contas e login:** o cadastro e a entrada gravam no banco (tabela `users`), com a senha em hash scrypt, e abrem uma sessão guardada num cookie httpOnly (o banco guarda só o hash do token, tabela `sessions`, com validade de 30 dias). Há dois tipos de conta: **empresa** (com nome da empresa e CNPJ; entra pelo Discover) e **desenvolvedor** (com cargo profissional; entra pelo formulário de perfil, já preenchido). A conta guarda quando confirmou o e-mail (`email_verified_at`); os códigos ficam em `email_codes`, só como hash, um por conta e finalidade.
- **E-mails:** enviados pelo [Resend](https://resend.com) quando `RESEND_API_KEY` está definida, com o remetente de `EMAIL_FROM`; saem no idioma da tela. Sem a chave, no desenvolvimento e nos testes, cada e-mail vai para o log do servidor (com o código); em produção, enviar falha.
- **Controle de acesso:** o guard `RequireAccount` (`src/components/require-account.tsx`) organiza a interface, e as server functions conferem o tipo de conta (`requireAccount` em `src/server/session.ts`).
- **Perfis:** um por conta de desenvolvedor, em `developer_profiles`, com skills e projetos em tabelas próprias. A tabela `skills` é o catálogo compartilhado das sugestões, com uma grafia por skill (índice único em `lower(name)`). As de referência (`curated`) vêm da migração `drizzle/0010_skill_catalog.sql`, organizadas por área; para incluir outras, crie uma migração nova com o mesmo formato. Skills digitadas que nenhum perfil ou projeto usa mais deixam de ser sugeridas. A foto é a que o desenvolvedor enviou no formulário (recortada em quadrado e reduzida para 512 px no navegador); sem ela, vem o avatar público do GitHub (`github.com/<usuário>.png`), e sem os dois, ou se a imagem não carregar, aparecem as iniciais. Os links abrem em nova aba.
- **Imagens:** fotos de perfil e capas de projeto ficam num armazenamento de arquivos, e o banco guarda só a URL. O formulário envia cada imagem nova como data URL ao salvar o perfil; o servidor a grava no armazenamento, mantém as que não mudaram e apaga as que o perfil deixou de usar. Uma URL só é aceita se já for uma imagem daquele perfil. Antes de gravar, o servidor confere que cada imagem nova é um JPEG completo e não maior do que o navegador gera (foto até 512×512, capa até 960×600); se alguma não for, nada é gravado e o perfil não é salvo. Com `BLOB_READ_WRITE_TOKEN` (o Blob store conectado ao projeto na Vercel), o armazenamento é o [Vercel Blob](https://vercel.com/docs/vercel-blob); sem ela, no desenvolvimento e nos testes, as imagens vão para a pasta `.uploads/` (ou `UPLOADS_DIR`) e são servidas pela rota `/uploads/...`. Em produção, sem o token, salvar uma imagem nova falha. `npm run images:migrate` move para o armazenamento as imagens gravadas no banco como data URL por versões anteriores.
- **Dados da empresa:** um registro por conta de empresa (`company_profiles`), lido e salvo só pela própria conta. Até a empresa salvar, valem o nome, o cargo e o e-mail do cadastro. O desenvolvedor só vê os dados de empresas que o contataram, por interesse ou proposta.
- **Talentos salvos, interesses e propostas:** ficam em `saved_talents`, `interests` e `meeting_requests`, ligados às contas da empresa e do desenvolvedor; apagar uma conta apaga esses registros. Só perfis publicados podem ser salvos, marcados ou receber proposta. O interesse aparece para o desenvolvedor com o contato atual da empresa; desfazer no Discover apaga o interesse, mas o e-mail do aviso já terá saído.
- **Limites de contato por empresa** (`src/lib/outreach.ts`): até 50 marcações de interesse e 20 propostas de reunião a cada 24 horas, e até 3 propostas para o mesmo desenvolvedor a cada 7 dias. Ao atingir um limite, a ação é recusada antes de qualquer e-mail, e a tela diz quanto tempo falta. Desfazer um interesse não devolve a marcação: cada uma fica em `interest_events`.
- **Limpeza diária** (`src/server/cleanup.ts`): um Cron da Vercel, agendado no `vite.config.ts`, chama `/api/cron/cleanup` às 03:00 de Brasília para apagar sessões vencidas, códigos expirados, falhas de login, envios de e-mail e perguntas ao assistente antigos, marcações de interesse com mais de 30 dias e skills digitadas sem uso. A rota só aceita o segredo `CRON_SECRET`.
- **Avisos por e-mail ao desenvolvedor** (`src/server/notifications.ts`): a marcação de interesse de uma empresa (no máximo um aviso da mesma empresa a cada 30 dias) e cada proposta de reunião. Saem no idioma da tela da empresa (o app não guarda o idioma preferido do desenvolvedor), com `Reply-To` para o contato dela; o de interesse leva um link para Empresas interessadas. Uma falha no aviso de interesse vai para o log e não desfaz a marcação.
- O resumo do profissional exibe seus dados; não existe percentual calculado de matching.

## O que ainda é simulado

- O assistente responde com uma mensagem simulada enquanto `VITE_ASSISTANT_API_URL` não estiver definida.
- Dados salvos no navegador por versões anteriores (perfis, shortlist, interesses, propostas e dados da empresa) não são migrados.

## Assistente de suporte com IA

O botão no canto inferior direito abre o chat do assistente, que responde dúvidas sobre o uso do StackMatch (contas, perfil, Discover, propostas, limites) com o modelo `claude-opus-5-5` da Anthropic.

A assistente se chama **Ada**, em homenagem a Ada Lovelace. A persona (simpática, prática, no feminino em português) fica no início do prompt, em `assistantGuide`, e deixa claro que ela é uma IA: ela se apresenta assim na primeira resposta, confirma isso se alguém perguntar e não finge ter experiências humanas. A tela do chat também mostra o selo "IA" e o aviso de que a Ada é uma IA e pode errar.

- **Backend:** a rota `POST /api/assistant` (`src/routes/api.assistant.ts`) recebe a conversa, confere o formato e o tamanho (até 30 mensagens, 4.000 caracteres cada e 30.000 no total, começando e terminando com uma mensagem da pessoa) e devolve a resposta em streaming como `text/plain`. Se a API da Anthropic falhar antes do primeiro trecho, a rota responde 502 e o chat oferece tentar de novo; fechar o chat ou parar a resposta cancela a chamada.
- **Conhecimento:** o guia do produto e as regras ficam no prompt de sistema em `src/server/assistant.ts` (`assistantGuide`). Ao mudar uma regra do app, atualize o guia também. O assistente sabe só a página aberta, o idioma da tela, o tipo de conta conectada e o primeiro nome da pessoa, que usa para cumprimentá-la; não lê outros dados da conta nem executa ações.
- **Formatação e atalhos:** as respostas aceitam um pedaço de Markdown (parágrafos, listas, **negrito** e `código`), lido em `src/lib/assistant-markdown.ts` e mostrado sem HTML. Um link para uma tela do app, como `[Abrir o Discover](/discover)`, vira um botão que leva para lá (no celular, o chat fecha). Só as rotas de `assistantPaths` viram botão; qualquer outro link aparece como texto.
- **Conversa por conta:** com login, a conversa fica no servidor (tabela `assistant_conversations`, até as 100 mensagens mais recentes), salva a cada resposta. Ela volta ao recarregar a página, entrar de novo ou usar outro aparelho, some da tela ao sair da conta e é apagada por "Nova conversa" ou ao excluir a conta. Sem login, a conversa fica só na página aberta. Para a IA vão só as 20 mensagens mais recentes. O guia fica em cache na API, então só a parte de cada conversa é cobrada inteira.
- **Custo e abuso:** cada IP pode fazer até 30 perguntas por hora (`src/server/assistant-throttle.ts`, tabela `assistant_requests`, limpa pela limpeza diária). Passando disso, a rota responde 429 e o chat diz quantos minutos faltam. O esforço do modelo fica em `low`, suficiente para respostas curtas.
- **Recusas:** a chamada usa o fallback do lado do servidor (`fallbacks: "default"`): se um classificador de segurança recusar, a API tenta outro modelo na mesma chamada. Se mesmo assim não vier texto, o chat mostra uma resposta padrão.

Para ativar, defina na Vercel (ou no `.env.local`, no desenvolvimento):

```sh
ANTHROPIC_API_KEY=sk-ant-...
VITE_ASSISTANT_API_URL=/api/assistant
```

`VITE_ASSISTANT_API_URL` entra no build do front, então mudar o valor pede um novo deploy. Sem ela, o chat usa as respostas simuladas e avisa que a IA não está conectada; com ela e sem a chave, a rota responde 503 e o chat mostra erro.

A URL também pode apontar para outro serviço com o mesmo contrato. O front envia um `POST` com JSON:

```json
{
  "messages": [{ "role": "user", "content": "Como funciona o Discover?" }],
  "locale": "pt-BR",
  "context": { "pathname": "/discover" }
}
```

A resposta pode ser texto em streaming (`text/plain`, exibido conforme chega) ou JSON no formato `{ "reply": "..." }`; um 429 com `Retry-After` vira o aviso de limite. O contrato e os transports ficam em `src/lib/assistant.ts`; a interface, em `src/components/assistant-widget.tsx`.

## Analytics de visitas (Vercel)

O projeto inclui o [Vercel Analytics](https://vercel.com/docs/analytics), desativado por padrão. Ele só coleta dados quando o site está hospedado na Vercel; em outros hosts, o script de coleta não existe.

Para ativar em um deploy na Vercel:

1. Habilite o Analytics no painel do projeto na Vercel.
2. Defina a variável de ambiente `VITE_VERCEL_ANALYTICS=true` e faça um novo deploy.

Sem essa variável, o componente não é incluído no build.

## Decisões técnicas

- **Só dados do banco:** o app não tem dados embutidos (o card de exemplo da home, com foto em `src/assets/hero-developer.jpg`, só ilustra o produto e não é um perfil); o seed é um script separado (`scripts/seed.ts`), rodado só onde as contas de teste devem existir.
- **Context e TanStack Query:** atendem ao volume e ao escopo do projeto sem uma camada adicional de gerenciamento de estado.
- **Backend no mesmo projeto:** server functions do TanStack Start, com Drizzle e Postgres, evitam um serviço separado e compartilham tipos e validações (Zod) com as telas. O PGlite deixa o desenvolvimento e os testes sem nada para instalar.
- **Sessão em cookie httpOnly:** o token não fica acessível ao JavaScript da página, e o banco guarda só o hash dele.
- **Filtros determinísticos:** opções do mesmo grupo usam OU; grupos diferentes usam E. O filtro de disponibilidade corresponde ao status selecionado. O valor máximo no limite (R$ 300) não restringe nada; abaixo dele, ficam de fora os perfis acima do valor ou sem valor informado. A consulta fica em `searchProfiles` (`src/server/profiles.ts`).
- **Ações separadas:** shortlist e interesse têm registros distintos, evitando confundir organização de candidatos com intenção de contato.
- **Componentes compartilhados:** cards, controles e diálogos mantêm padrões de interação entre telas.
- **Escopo explícito:** a integração ausente (o assistente de IA) é apresentada como simulação.

## Limitações conhecidas

- Contas, perfis de desenvolvedor, dados da empresa, shortlist, interesses e propostas ficam no servidor, que confere o tipo de conta antes de ler ou salvar. Não há verificação de profissionais.
- A proposta de reunião não consulta a agenda do profissional; confirmar ou remarcar acontece por e-mail, fora do app.
- Os perfis de desenvolvedor ficam no banco (tabelas `developer_profiles`, `skills`, `developer_skills`, `projects` e `project_skills`), um por conta e identificados pelo id dela. Cada conta edita só o próprio perfil, e o Discover lista os de todas as contas de desenvolvedor, na ordem em que foram publicados. Para empresas, cada um é um candidato como os outros, com página em `/developer/<id da conta>` no mesmo formato dos demais; o selo "Seu perfil" aparece só para o dono. Perfis que deixam valor por hora ou tipo de contratação em branco saem da lista quando esses filtros estão ativos.
- O Discover mostra só os perfis publicados no banco; com poucos perfis, algumas opções de filtro não retornam resultados. Não há busca geográfica, ranking ou recomendação automática.
- Filtros, posição na descoberta e histórico de desfazer não persistem entre sessões. O formulário guarda seu conteúdo em estado durante a edição e persiste ao concluir.
- Acessibilidade e responsividade receberam ajustes pontuais; ainda cabe uma validação mais ampla com usuários, leitores de tela e diferentes dispositivos.
- Os testes automatizados cobrem a lógica (Vitest, `npm test`) e os principais fluxos no navegador (Playwright, `npm run test:e2e`).

## Próximos passos

1. Validar com contratantes e desenvolvedores se os dados dos cards são suficientes para a triagem inicial.
2. Definir uma regra de compatibilidade entre vaga e perfil, para que o "match" do produto seja calculado.
3. Mostrar o status das propostas de reunião para os dois lados (enviada, vista, respondida).
4. Deixar o desenvolvedor desligar os avisos por e-mail.
5. Integrar o GitHub (importar projetos) depois de definir permissões e privacidade.
