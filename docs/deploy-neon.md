# Deploy na Vercel com Neon

O StackMatch guarda contas, perfis, dados da empresa, talentos salvos, interesses e propostas num Postgres. Em produção, esse banco é o Neon, conectado ao projeto da Vercel. Sem ele, o site publicado não funciona: o servidor recusa subir em produção sem `DATABASE_URL`.

No desenvolvimento local, nada disso é necessário. Sem `DATABASE_URL`, o servidor usa o PGlite (um Postgres que roda dentro do Node), gravando na pasta `.pglite/`.

## 1. Criar o banco pela integração da Vercel

1. No painel da Vercel, abra o projeto **stackmatch-connect** e vá na aba **Storage**.
2. Clique em **Create Database**, escolha **Neon (Serverless Postgres)** e aceite criar a conta no Neon, se ela pedir.
3. Em **Região**, escolha **US East (N. Virginia)**. É a mesma região padrão das funções da Vercel (`iad1`), o que evita que cada consulta atravesse o continente.
4. Em **Connect to project**, marque os ambientes **Production**, **Preview** e **Development**.

A integração cria sozinha as variáveis de ambiente do projeto, entre elas a **`DATABASE_URL`**, que é a que o código usa. Não precisa copiar nada à mão para a Vercel.

## 2. Criar as tabelas

O deploy não cria nem altera tabelas. As migrações (pasta `drizzle/`) são aplicadas daqui, pelo `npm run db:migrate`, na primeira configuração e sempre que uma migração nova entrar no projeto.

1. No Neon, abra o banco criado e clique em **Connect**.
2. Copie a connection string com **Connection pooling desligado**: para migrações, a conexão direta é a mais segura. Ela começa com `postgresql://`, e o host não tem `-pooler`.
3. Na pasta do projeto, crie o arquivo **`.env.migrate.local`** com uma linha:

   ```sh
   DATABASE_URL=postgresql://...cole-aqui...
   ```

   O git ignora esse arquivo (`*.local` no `.gitignore`). O modelo está em `.env.example`.

4. Rode:

   ```sh
   npm run db:migrate
   ```

   As migrações devem terminar sem erro. Se a conexão falhar, o comando fica tentando em vez de encerrar: interrompa com `Ctrl+C` e confira a string.

**Não coloque a `DATABASE_URL` no `.env` nem no `.env.local`.** O servidor de desenvolvimento carrega esses dois arquivos e passaria a usar o banco de produção no lugar do PGlite. O `.env.migrate.local` só é lido pelo `db:migrate`.

A connection string dá acesso total ao banco. Não a cole em chats, issues ou arquivos versionados. Se ela vazar, gere outra senha no Neon (**Roles → Reset password**) e atualize o `.env.migrate.local`. A integração atualiza a variável na Vercel.

Se preferir não criar o arquivo, a variável também pode ser definida só para o terminal atual. No PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://...cole-aqui..."
npm run db:migrate
```

## 3. Criar as contas de teste (opcional)

O app não cria nenhum dado sozinho. Para ter as contas de teste no banco, rode o seed, que usa a mesma `DATABASE_URL` do `.env.migrate.local`:

```sh
npm run db:seed
```

Ele cria `teste.dev@stackmatch.app` (desenvolvedor, com o perfil do Gabriel Botelho) e `teste.emp@stackmatch.app` (empresa), com a senha `teste1234`, e termina com `Seed applied to <host>`. O que já existe no banco não é alterado, então rodar de novo não faz mal.

A senha está no código público: qualquer pessoa pode entrar nessas contas e alterar os dados delas. Rode o seed só se elas forem úteis nesse banco, por exemplo para uma demonstração.

## 4. Fazer um novo deploy

A integração não refaz o deploy sozinha. Em **Deployments**, abra o último deploy e use **⋯ → Redeploy**.

## 5. Conferir

No site publicado:

1. Se rodou o seed, entre com `teste.emp@stackmatch.app` / `teste1234`. O Discover deve mostrar o Gabriel Botelho.
2. Crie uma conta nova, saia e entre de novo.
3. Como empresa, salve um talento e recarregue a página: ele continua em Talentos salvos.

Se algo falhar, os erros aparecem em **Deployments → (deploy) → Logs**. Os mais comuns:

| Erro                                                         | Causa                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `DATABASE_URL must point to a Postgres server in production` | A variável não está no ambiente do deploy. Confira o passo 1 e refaça o deploy. |
| `relation "users" does not exist`                            | As migrações não foram aplicadas nesse banco. Rode o passo 2.                   |
| Login não funciona, sem erro no log                          | Confira se o deploy é posterior à criação do banco (passo 4).                   |

## Depois de mudar o schema

1. Altere `src/server/db/schema.ts`.
2. Gere a migração com `npm run db:generate` e faça commit da pasta `drizzle/`.
3. Antes do deploy, rode `npm run db:migrate` (passo 2) para aplicá-la no Neon. Uma migração que cria uma coluna ou tabela que o código novo usa precisa estar no banco antes de o código chegar à produção.

O PGlite local aplica as migrações sozinho ao iniciar.
