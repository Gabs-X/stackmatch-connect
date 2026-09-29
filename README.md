# Talent Matcher

Crie um projeto front-end completo e moderno chamado StackMatch, uma plataforma de descoberta rápida de desenvolvedores e freelancers.

A proposta do produto é permitir que empresas, recrutadores ou contratantes encontrem profissionais de tecnologia de forma rápida e visual, utilizando filtros por stack, senioridade, disponibilidade, localização e tipo de contratação.

O conceito pode lembrar a dinâmica de descoberta do Tinder, mas o produto deve ter aparência profissional de SaaS B2B, e não de aplicativo de namoro.

Objetivo do projeto

Criar apenas o front-end funcional e navegável, utilizando dados mockados.

Não criar backend real, banco de dados, autenticação real ou integrações externas neste momento.

O projeto será utilizado como MVP e demonstração de produto.

Tecnologias

Utilizar preferencialmente:

React

TypeScript

TailwindCSS

Lucide Icons

Framer Motion para animações

Se o ambiente do Lovable utilizar Vite por padrão, manter Vite.

Criar componentes reutilizáveis e manter uma arquitetura organizada.

Identidade visual

Criar uma identidade moderna de startup/SaaS.

Visual:

clean

moderno

profissional

minimalista

tecnológico

premium

Evitar estética infantil ou exageradamente colorida.

Sugestão de paleta:

fundo principal claro ou off-white

tons escuros de grafite

azul/índigo como cor principal

verde suave para disponibilidade e ações positivas

vermelho apenas para ações como "passar"

Utilizar:

cards com bordas arredondadas

sombras discretas

bastante espaçamento

tipografia moderna

microinterações

animações suaves

layout totalmente responsivo

Estrutura do produto

Criar as seguintes páginas:

1. Landing Page

Página inicial apresentando o produto.

Header com:

logo StackMatch

Discover

Talentos

Para Desenvolvedores

botão "Começar agora"

Hero principal com headline semelhante a:

"Encontre o desenvolvedor certo para o seu próximo projeto."

Subheadline:

"Descubra profissionais com as tecnologias, experiência e disponibilidade que sua empresa precisa."

Botões:

Encontrar talentos

Criar meu perfil

Criar ao lado do Hero uma prévia visual de um Developer Card.

Adicionar uma seção explicando como funciona em 3 passos:

Defina o que procura

Descubra profissionais compatíveis

Salve seus favoritos

Criar também uma seção de benefícios:

busca mais rápida

filtros inteligentes

análise por projetos

disponibilidade visível

mini portfólio profissional

Adicionar CTA final.

2. Discover

Esta deve ser a principal tela do produto.

Criar uma experiência de descoberta de desenvolvedores baseada em cards.

Layout desktop:

sidebar ou botão de filtros

área central com Developer Card grande

painel lateral opcional com informações adicionais

Developer Card deve conter:

foto/avatar

nome

cargo

senioridade

localização

remoto/presencial

disponibilidade

breve descrição

principais skills

experiência

2 ou 3 projetos em destaque

botão "Ver perfil"

Criar ações:

Passar

Salvar

Interessado

Adicionar suporte visual para swipe.

Se possível, utilizar Framer Motion para permitir arrastar o card.

Ao arrastar para a direita mostrar uma indicação visual:

"INTERESSADO"

Ao arrastar para a esquerda:

"PASSAR"

Adicionar botões abaixo do card para executar as mesmas ações sem swipe.

Ao passar ou salvar um perfil, mostrar o próximo profissional da lista mockada.

3. Filtros

Criar um drawer, modal ou sidebar contendo filtros.

Filtros:

Tecnologias:

React

Next.js

Angular

Vue

Node.js

NestJS

C#

.NET

Java

Python

PostgreSQL

MySQL

MongoDB

AWS

Docker

Senioridade:

Júnior

Pleno

Sênior

Tipo de contratação:

Freelancer

Contrato

CLT

PJ

Disponibilidade:

Imediata

15 dias

30 dias

Localização:

Remoto

Híbrido

Presencial

Faixa de valor:
criar slider visual.

Adicionar chips de filtros ativos no topo da página Discover.

Exemplo:

React ×
Pleno ×
Remoto ×

4. Perfil completo do desenvolvedor

Criar rota individual de perfil.

Exemplo:

/developer/

Tela contendo:

avatar grande

nome

cargo

senioridade

localização

disponibilidade

botão "Salvar"

botão "Entrar em contato"

Seções:

Sobre mim

Skills

Experiência

Projetos

Links profissionais

Criar cards de projetos contendo:

imagem

nome

descrição

tecnologias

GitHub

Demo

Criar 3 projetos mockados por desenvolvedor.

5. Talentos salvos

Criar uma página de shortlist.

Mostrar todos os perfis que o usuário marcou como interessado ou salvou.

Formato:

grid de cards.

Cada card deve mostrar:

avatar

nome

cargo

skills

disponibilidade

botão "Ver perfil"

botão para remover dos salvos

Adicionar empty state caso nenhum candidato tenha sido salvo.

Mensagem:

"Você ainda não salvou nenhum talento."

6. Criar perfil de desenvolvedor

Criar uma página onde o desenvolvedor possa montar seu mini portfólio.

Dividir em etapas.

Etapa 1 — Informações pessoais

nome

cargo

localização

bio

senioridade

disponibilidade

Etapa 2 — Skills

Criar campo para adicionar tecnologias como tags.

Etapa 3 — Projetos

Permitir adicionar projetos com:

nome

descrição

tecnologias

imagem

GitHub

link de demonstração

Etapa 4 — Links

GitHub

LinkedIn

site pessoal

Adicionar botão:

"Importar projetos do GitHub"

Este botão não precisa integrar de verdade.

Ao clicar, abrir um modal mockado contendo alguns repositórios:

Ecommerce API

Portfolio

Task Manager

Finance Dashboard

Permitir selecionar projetos e clicar:

"Importar selecionados"

Depois adicionar esses projetos ao formulário.

7. Preview do perfil

Durante a criação do perfil, adicionar opção:

"Visualizar perfil"

Mostrar uma prévia de como o contratante verá o perfil.

Dados mockados

Criar pelo menos 8 desenvolvedores fictícios.

Variar:

foto/avatar

stack

senioridade

localização

disponibilidade

experiência

projetos

Exemplo:

Gabriel Botelho
Full Stack Developer
Pleno
Uberaba, MG
Remoto
Disponível agora

Skills:
React
Next.js
Node.js
NestJS
C#
PostgreSQL

Outro exemplo:

Marina Costa
Frontend Developer
Sênior
São Paulo, SP
Remoto

Skills:
React
Next.js
TypeScript
Tailwind
GraphQL

Criar diversidade de perfis e stacks.

Navegação

Criar header persistente com:

StackMatch

Discover

Talentos salvos

Criar perfil

No mobile utilizar menu responsivo.

Estados da interface

Criar estados visuais para:

loading

nenhum resultado

nenhum talento salvo

filtros sem resultado

Adicionar skeleton loading em alguns componentes.

Responsividade

O projeto precisa funcionar bem em:

desktop

tablet

mobile

No mobile, o card de descoberta deve ocupar quase toda a largura da tela.

Filtros devem abrir como drawer ou modal.

Experiência do usuário

Adicionar:

animações suaves

hover states

transições

tooltips quando necessário

feedback ao salvar candidato

toast quando perfil for salvo

toast ao importar projeto mockado

Importante

Este projeto deve ser SOMENTE FRONT-END.

Não implementar:

Supabase

Firebase

banco de dados

API

autenticação real

login real

pagamentos

chat real

integração real com GitHub

Utilizar arrays e objetos locais para simular os dados.

Estruturar o código de maneira que futuramente seja fácil substituir os mocks por uma API.

Resultado esperado

Quero que o projeto pareça um MVP real de uma startup pronta para ser apresentada a investidores ou clientes.

Priorizar principalmente:

experiência de descoberta

qualidade visual

animação dos cards

filtros

perfil profissional

portfólio dos desenvolvedores

responsividade

A página Discover deve ser o principal destaque visual do produto.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stackmatch-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eaaacb72-e979-5df1-babb-b0232a2fdea4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
