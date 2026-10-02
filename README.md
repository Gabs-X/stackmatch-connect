# StackMatch

Protótipo de front-end para descoberta de desenvolvedores e freelancers, criado em aproximadamente uma semana para um processo seletivo. O projeto utilizou **Lovable conforme orientação do teste**, com ajustes no código para completar fluxos e revisar comportamento, acessibilidade e consistência dos dados.

**Backend não fazia parte do escopo.** Os fluxos de produto usam dados fictícios e estado no navegador.

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
- **Dados da empresa:** página da conta de empresa (`/company-settings`, no menu da conta) com site, localização, descrição e o contato para os desenvolvedores (nome do colaborador, cargo, e-mail e telefone). Propostas de reunião e interesses marcados no Discover saem assinados com esse contato, e as respostas vão para o e-mail de contato. Nome da empresa, CNPJ e e-mail de login aparecem só para consulta. O CNPJ é pedido no cadastro de empresa, com máscara e validação dos dígitos verificadores; a conta `teste.emp` usa o CNPJ de exemplo 11.222.333/0001-81.
- **Contas de teste:** `teste.dev` (desenvolvedor) e `teste.emp` (empresa), ambas com a senha `teste1234`. Entre pelo usuário ou pelo e-mail (`teste.dev@stackmatch.app` / `teste.emp@stackmatch.app`); a tela de login tem atalhos que preenchem cada uma. A conta `teste.dev` é o Gabriel Botelho e já vem com o perfil dele publicado. Em deploys públicos, defina `VITE_DEMO_ACCOUNTS=false`: isso remove as contas de teste, os atalhos do login e o perfil de demonstração do Gabriel, já que a senha fica no código.
- **Perfil completo:** bio, cargo, senioridade, experiência, tecnologias e projetos.
- **Talentos salvos:** cards compactos com dados para consulta, acesso ao perfil e remoção da shortlist.
- **Criação de perfil:** formulário em etapas (incluindo anos de experiência, valor por hora e tipos de contratação, usados pelos filtros do Discover), skills, projetos com descrição, tecnologias, imagem de capa, repositório e demo (com edição e remoção), links, preview com o card que as empresas veem no Discover e salvamento local ao concluir.
- **Importação simulada do GitHub:** seleção de projetos fictícios para o perfil.
- **Proposta de reunião:** uma conta de empresa sugere um horário (data e hora, em GMT−3) e escreve uma mensagem opcional. O profissional recebe a proposta por e-mail e responde direto para a empresa: o StackMatch não gerencia a reunião nem bloqueia horários. O diálogo mostra uma prévia do e-mail e avisa quando já houve proposta para o mesmo profissional. Visitantes são levados ao login; contas de desenvolvedor não enviam propostas.
- **Assistente (prévia):** chat flutuante com sugestões, digitação em streaming e opção de parar a resposta, pronto para conectar a um backend de IA.
- **PT-BR e EN**, interface responsiva e ajustes de acessibilidade, incluindo labels, estados de seleção e respeito à preferência por movimento reduzido nos cards.

## Stack utilizada

- React 19 e TypeScript em modo estrito.
- TanStack Start e TanStack Router para estrutura da aplicação e rotas por arquivos.
- Vite 8, com configuração fornecida pelo Lovable.
- Tailwind CSS 4 e componentes baseados em Radix UI.
- Framer Motion para animações e arraste dos cards.
- Lucide para ícones e Sonner para notificações.
- date-fns e React DayPicker para datas e calendário.
- Zod para validação da estrutura do perfil local.
- ESLint e Prettier para verificação e formatação.

TanStack Query está configurado na base do projeto, mas os fluxos atuais não dependem de consultas a uma API de produto.

## Como executar

Pré-requisitos: Node.js 22.12 ou superior e npm.

Na pasta do repositório:

```sh
npm install
npm run dev
```

Acesse o endereço informado pelo Vite no terminal. Os fluxos mockados não exigem credenciais de GitHub, Google Calendar ou banco de dados.

### Verificações

```sh
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
npm run build
```

Os testes de interface (Playwright) sobem o servidor de desenvolvimento sozinhos e usam o Google Chrome instalado na máquina. Onde ele não existir, rode `npx playwright install chrome` antes. Eles cobrem Discover (ações, desfazer, filtros), perfil (links reais e de demonstração, avatar do GitHub e fallback), criação de perfil até o Discover, idioma e tema, assistente, proposta de reunião e o layout em celular.

Para visualizar o build localmente:

```sh
npm run preview
```

O lint pode apresentar avisos de `react-refresh/only-export-components` em módulos que exportam componentes junto com funções ou constantes. Eles se referem ao Fast Refresh em desenvolvimento.

## Arquitetura em alto nível

| Local                         | Responsabilidade                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `src/routes/`                 | Páginas: início, Discover, perfil, talentos salvos e criação de perfil.          |
| `src/components/`             | Componentes de produto, como cards, filtros, cabeçalho e proposta de reunião.    |
| `src/components/ui/`          | Primitivas reutilizáveis de interface.                                           |
| `src/lib/developers.ts`       | Tipos e catálogo mockado de profissionais e projetos.                            |
| `src/lib/app-context.tsx`     | Estado compartilhado de shortlist, interesses e propostas de reunião enviadas.   |
| `src/lib/meeting-requests.ts` | Formato das propostas de reunião, horários aceitos e leitura do histórico local. |
| `src/lib/local-profile.ts`    | Estrutura, validação e persistência dos perfis, um por conta de desenvolvedor.   |
| `src/lib/i18n.tsx`            | Dicionários, idioma ativo e formatação de valores.                               |
| `src/styles.css`              | Estilos globais e tokens visuais.                                                |

Estados transitórios, como filtros, etapa do formulário e posição na lista, ficam nos componentes. Os dados compartilhados usam Context; shortlist, interesses, propostas enviadas, perfil concluído e preferência de idioma usam `localStorage`.

Embora TanStack Start tenha infraestrutura de renderização no servidor, não há backend de negócio, banco de dados ou API de contratação implementados.

## PT-BR / EN

O seletor no cabeçalho alterna entre português brasileiro e inglês e guarda a preferência no navegador. Os textos ficam em dicionários tipados em `src/lib/i18n.tsx`.

Os valores dos mocks são traduzidos na apresentação, preservando os dados usados pelos filtros. Datas seguem o idioma selecionado; preços permanecem em **BRL**, sem conversão cambial. Os horários propostos usam o horário de Brasília (GMT−3).

## O que está mockado

- Os sete profissionais do catálogo, suas bios, projetos, valores, experiências e disponibilidades são fictícios. A home não faz alegações de volume ou verificação de perfis.
- A importação do GitHub é uma **simulação de front-end**, sem OAuth ou consulta a repositórios reais.
- O envio da proposta de reunião é **simulado**: `sendMeetingRequest` em `src/lib/api.ts` faz o papel do futuro `POST /meeting-requests`, que enviará o e-mail ao profissional com `Reply-To` da empresa. Nenhum e-mail é enviado; a proposta fica registrada neste navegador para a empresa lembrar com quem já falou.
- O interesse é um registro local, sem notificação, chat ou contato externo; quando feito por uma conta de empresa, aparece para o desenvolvedor em Empresas interessadas.
- **Contas e login são simulados.** Cadastro, entrada e recuperação de senha funcionam só neste navegador: as contas ficam no `localStorage` com a senha guardada como hash SHA-256 (o que evita texto puro, mas não é segurança real), e nenhum e-mail é enviado. Há dois tipos de conta: **empresa** (com nome da empresa; entra pelo Discover) e **desenvolvedor** (com cargo profissional; entra pelo formulário de perfil, já preenchido). As funções ficam em `src/lib/auth.ts` e podem ser trocadas por chamadas à API sem mudar as telas.
- **Controle de acesso e empresas interessadas são de front-end.** O guard `RequireAccount` (`src/components/require-account.tsx`) só organiza a interface; o backend precisará validar o tipo de conta em cada endpoint. Interesses marcados por empresas ficam neste navegador (`stackmatch-profile-interests`) e são associados ao perfil pelo id da conta do desenvolvedor; `fetchCompanyActivity` em `src/lib/api.ts` faz o papel do futuro `GET /me/interested-companies` e devolve atividade fictícia (de `src/lib/developers.ts`) apenas para a conta `teste.dev`. As contas de teste ficam em `src/lib/auth.ts`, fora do `localStorage`.
- Propostas e interesses guardam o id da conta da empresa (`companyId`), que identifica quem já contatou cada profissional mesmo se a empresa trocar o e-mail de contato. Registros antigos, sem esse campo, usam o e-mail no lugar.
- Os dados da empresa ficam neste navegador, por conta (`stackmatch-company-settings`): `fetchCompanySettings` e `saveCompanySettings` em `src/lib/api.ts` fazem o papel do futuro `GET/PUT /company/settings`.
- O assistente responde com uma mensagem simulada enquanto `VITE_ASSISTANT_API_URL` não estiver definida.
- Os links de GitHub, LinkedIn e demos dos perfis mockados usam endereços de exemplo: ao clicar, um aviso mostra o endereço sem navegar, já que essas URLs podem pertencer a pessoas reais. Links válidos preenchidos no perfil local podem ser abertos pelo usuário.
- O perfil do Gabriel Botelho é o perfil da conta `teste.dev` (`demoDeveloperProfile` em `src/lib/developers.ts`), usado até essa conta salvar as próprias edições. Ele usa links reais, que abrem em nova aba, e a foto vem do avatar público do GitHub (`github.com/<usuário>.png`). O perfil criado no navegador também usa esse avatar quando o GitHub é preenchido; se a imagem não carregar, aparecem as iniciais.
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

O projeto inclui o [Vercel Analytics](https://vercel.com/docs/analytics), desativado por padrão. Ele só coleta dados quando o site está hospedado na Vercel; em outros hosts, como o Lovable, o script de coleta não existe.

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

- Não há autenticação, autorização, verificação de profissionais nem persistência remota. Limpar os dados do navegador apaga os registros locais.
- A proposta de reunião não consulta a agenda do profissional; confirmar ou remarcar acontece por e-mail, fora do app.
- Os perfis de desenvolvedor ficam neste navegador (`stackmatch-profiles`), um por conta e identificados pelo id dela, no lugar do futuro `GET/PUT /me/profile` e `GET /profiles`. Cada conta edita só o próprio perfil, e o Discover lista os de todas as contas de desenvolvedor criadas aqui. Para empresas, cada um é um candidato como os outros, com página em `/developer/<id da conta>` no mesmo formato dos demais; o selo "Seu perfil" aparece só para o dono. Versões anteriores guardavam um único perfil sem dono (`stackmatch-profile`), que é descartado. Perfis que deixam valor por hora ou tipo de contratação em branco saem da lista quando esses filtros estão ativos. As imagens de capa dos projetos são reduzidas e salvas no `localStorage`, que tem limite de cerca de 5 MB por site.
- O catálogo é pequeno e estático; algumas opções de filtro podem não retornar resultados. Não há busca geográfica, ranking ou recomendação automática.
- As imagens de perfil incluem reutilizações entre personagens fictícios.
- Filtros, posição na descoberta e histórico de desfazer não persistem entre sessões. O formulário guarda seu conteúdo em estado durante a edição e persiste ao concluir.
- Acessibilidade e responsividade receberam ajustes pontuais; ainda cabe uma validação mais ampla com usuários, leitores de tela e diferentes dispositivos.
- Os testes automatizados cobrem a lógica (Vitest, `npm test`) e os principais fluxos no navegador (Playwright, `npm run test:e2e`).

## Próximos passos

1. Validar com contratantes e desenvolvedores se os dados dos cards são suficientes para a triagem inicial.
2. Rodar as suítes automaticamente a cada push (CI).
3. Refinar validações do formulário e ampliar o cadastro de projetos, conforme feedback de uso.
4. Em uma etapa com backend, definir contratos de API, autenticação, publicação de perfis e persistência por usuário.
5. Integrar o GitHub e o envio de e-mails apenas após definir permissões, privacidade e limites contra spam nas propostas de reunião.

## Lovable

O uso do Lovable integrou o desenvolvimento conforme a orientação do teste. O repositório permanece conectado à ferramenta.

- [Aplicação publicada](https://stackmatch-connect.lovable.app)
- [Projeto no Lovable](https://lovable.dev/projects/eaaacb72-e979-5df1-babb-b0232a2fdea4)

Ao colaborar, preserve o histórico publicado: evite force push ou reescrita de commits já enviados, pois isso interfere na sincronização com o Lovable.
