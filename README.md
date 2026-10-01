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

- **Discover:** filtros por tecnologias, senioridade, modelo de trabalho, contratação, disponibilidade e valor máximo por hora. Chips permitem remover seleções.
- **Ações distintas:** passar avança; salvar adiciona à shortlist; interessado registra interesse separadamente e também salva o perfil. Nenhuma ação envia contato ao profissional.
- **Navegação por cards:** botões e arraste, opção de desfazer e encerramento explícito da lista, com reinício manual.
- **Perfil completo:** bio, cargo, senioridade, experiência, tecnologias e projetos.
- **Talentos salvos:** cards compactos com dados para consulta, acesso ao perfil e remoção da shortlist.
- **Criação de perfil:** formulário em etapas, skills, inclusão de projetos pelo nome, links, preview e salvamento local ao concluir.
- **Importação simulada do GitHub:** seleção de projetos fictícios para o perfil.
- **Agendamento local:** escolha de data e horário, dados do contratante e confirmação. Horários passados ou já reservados para o mesmo profissional ficam indisponíveis.
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
npm run build
```

Para visualizar o build localmente:

```sh
npm run preview
```

O lint pode apresentar avisos de `react-refresh/only-export-components` em módulos que exportam componentes junto com funções ou constantes. Eles se referem ao Fast Refresh em desenvolvimento.

## Arquitetura em alto nível

| Local                      | Responsabilidade                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| `src/routes/`              | Páginas: início, Discover, perfil, talentos salvos e criação de perfil.          |
| `src/components/`          | Componentes de produto, como cards, filtros, cabeçalho e diálogo de agendamento. |
| `src/components/ui/`       | Primitivas reutilizáveis de interface.                                           |
| `src/lib/developers.ts`    | Tipos e catálogo mockado de profissionais e projetos.                            |
| `src/lib/app-context.tsx`  | Estado compartilhado de shortlist, interesses e agendamentos.                    |
| `src/lib/appointments.ts`  | Leitura das reservas locais e regras de disponibilidade dos horários.            |
| `src/lib/local-profile.ts` | Estrutura, validação e persistência do perfil criado no navegador.               |
| `src/lib/i18n.tsx`         | Dicionários, idioma ativo e formatação de valores.                               |
| `src/styles.css`           | Estilos globais e tokens visuais.                                                |

Estados transitórios, como filtros, etapa do formulário e posição na lista, ficam nos componentes. Os dados compartilhados usam Context; shortlist, interesses, reservas, perfil concluído e preferência de idioma usam `localStorage`.

Embora TanStack Start tenha infraestrutura de renderização no servidor, não há backend de negócio, banco de dados ou API de contratação implementados.

## PT-BR / EN

O seletor no cabeçalho alterna entre português brasileiro e inglês e guarda a preferência no navegador. Os textos ficam em dicionários tipados em `src/lib/i18n.tsx`.

Os valores dos mocks são traduzidos na apresentação, preservando os dados usados pelos filtros. Datas seguem o idioma selecionado; preços permanecem em **BRL**, sem conversão cambial. A agenda utiliza o horário de Brasília (GMT−3).

## O que está mockado

- Os oito profissionais, suas bios, projetos, valores, experiências e disponibilidades são fictícios. Números e alegações da apresentação do produto não representam uma base real de usuários ou verificações.
- A importação do GitHub é uma **simulação de front-end**, sem OAuth ou consulta a repositórios reais.
- A agenda é uma **simulação local**: grava reservas neste navegador, sem Google Calendar, envio de e-mails ou geração de links de videochamada.
- O interesse é um registro local, sem notificação, chat ou contato externo.
- O assistente responde com uma mensagem simulada enquanto `VITE_ASSISTANT_API_URL` não estiver definida.
- Links externos sem destino nos perfis mockados ficam indisponíveis. Links válidos preenchidos no perfil local podem ser abertos pelo usuário.
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
- Reservas não representam disponibilidade real e não têm garantia de concorrência entre usuários ou dispositivos.
- O perfil criado fica no navegador e não é publicado nem incorporado ao catálogo do Discover. O cadastro de projetos armazena apenas seus nomes.
- O catálogo é pequeno e estático; algumas opções de filtro podem não retornar resultados. Não há busca geográfica, ranking ou recomendação automática.
- As imagens de perfil incluem reutilizações entre personagens fictícios.
- Filtros, posição na descoberta e histórico de desfazer não persistem entre sessões. O formulário guarda seu conteúdo em estado durante a edição e persiste ao concluir.
- Acessibilidade e responsividade receberam ajustes pontuais; ainda cabe uma validação mais ampla com usuários, leitores de tela e diferentes dispositivos.
- Não há uma suíte automatizada abrangente de testes de interface.

## Próximos passos

1. Validar com contratantes e desenvolvedores se os dados dos cards são suficientes para a triagem inicial.
2. Ampliar testes automatizados dos fluxos de descoberta, criação de perfil, persistência e agendamento.
3. Refinar validações do formulário e ampliar o cadastro de projetos, conforme feedback de uso.
4. Em uma etapa com backend, definir contratos de API, autenticação, publicação de perfis e persistência por usuário.
5. Integrar GitHub e calendário apenas após definir permissões, privacidade e tratamento de conflitos de agenda.

## Lovable

O uso do Lovable integrou o desenvolvimento conforme a orientação do teste. O repositório permanece conectado à ferramenta.

- [Aplicação publicada](https://stackmatch-connect.lovable.app)
- [Projeto no Lovable](https://lovable.dev/projects/eaaacb72-e979-5df1-babb-b0232a2fdea4)

Ao colaborar, preserve o histórico publicado: evite force push ou reescrita de commits já enviados, pois isso interfere na sincronização com o Lovable.
