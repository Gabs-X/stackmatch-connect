# Deploying on Vercel with Neon

StackMatch stores accounts, profiles, company details, saved talent, interests and proposals in Postgres. In production, that database is Neon, connected to the Vercel project. Without it, the published site doesn't work: the server refuses to start in production without `DATABASE_URL`.

None of this is needed for local development. Without `DATABASE_URL`, the server uses PGlite (a Postgres that runs inside Node), writing to the `.pglite/` folder.

## 1. Create the database through the Vercel integration

1. In the Vercel dashboard, open the **stackmatch-connect** project and go to the **Storage** tab.
2. Click **Create Database**, choose **Neon (Serverless Postgres)** and agree to create the Neon account if asked.
3. Under **Region**, choose **US East (N. Virginia)**. It is the same default region as Vercel's functions (`iad1`), which keeps each query from crossing the continent.
4. Under **Connect to project**, check the **Production**, **Preview** and **Development** environments.

The integration creates the project's environment variables on its own, among them **`DATABASE_URL`**, which is the one the code uses. There is nothing to copy into Vercel by hand.

## 2. Create the tables

On every production deploy, Vercel applies the pending migrations (`drizzle/` folder) before building the site, through the `vercel-build` script: see [Migrations on deploy](#migrations-on-deploy). Running them from here, with `npm run db:migrate`, is for the first setup (before the first deploy) and for checking the database.

1. In Neon, open the database you created and click **Connect**.
2. Copy the connection string with **Connection pooling off**: for migrations, the direct connection is the safest. It starts with `postgresql://`, and the host has no `-pooler`.
3. In the project folder, create the **`.env.migrate.local`** file with one line:

   ```sh
   DATABASE_URL=postgresql://...paste-here...
   ```

   Git ignores this file (`*.local` in `.gitignore`). The template is in `.env.example`.

4. Run:

   ```sh
   npm run db:migrate
   ```

   The migrations should finish without errors. If the connection fails, the command keeps retrying instead of exiting: stop it with `Ctrl+C` and check the string.

**Don't put `DATABASE_URL` in `.env` or `.env.local`.** The dev server loads both files and would start using the production database instead of PGlite. `.env.migrate.local` is only read by `db:migrate`.

The connection string gives full access to the database. Don't paste it in chats, issues or versioned files. If it leaks, generate a new password in Neon (**Roles → Reset password**) and update `.env.migrate.local`. The integration updates the variable on Vercel.

If you'd rather not create the file, the variable can also be set for the current terminal only. In PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://...paste-here..."
npm run db:migrate
```

## 3. Create the test accounts (optional)

The app doesn't create any data on its own. To have the test accounts in the database, run the seed, which uses the same `DATABASE_URL` from `.env.migrate.local`:

```sh
npm run db:seed
```

It creates `teste.dev@example.com` (developer, with Gabriel Botelho's profile) and `teste.emp@example.com` (company), with the password `teste1234`, and ends with `Seed applied to <host>`. Whatever already exists in the database isn't changed, so running it again does no harm.

The password is in the public code: anyone can sign in to these accounts and change their data. Run the seed only if they are useful in that database, for a demo, for example.

## 4. Create the image storage

Profile photos and project covers live in Vercel Blob; the database stores only each one's URL. Without it, the published site can't save new images.

1. In the Vercel dashboard, in the **stackmatch-connect** project, go to **Storage → Create Database → Blob**, give it a name and connect it to the project, in the **Production**, **Preview** and **Development** environments.
2. The integration creates the **`BLOB_READ_WRITE_TOKEN`** variable in the project. There is nothing to copy into Vercel.
3. If the database has images from before the storage (stored as data URLs), move them: copy the Blob store token (**Storage → (the store) → .env.local**) into `.env.migrate.local`, next to `DATABASE_URL`, and run:

   ```sh
   npm run images:migrate
   ```

   It ends with `Moved N profile photo(s) and N project cover(s).` Running it again does nothing once everything has been moved. Without the token in the file, the command stops with a message instead of writing the images to a local folder.

The token gives write access to the Blob store: the same rules as the connection string apply to it.

## 5. Set up sending e-mails

E-mail confirmation and password recovery codes go out through [Resend](https://resend.com). Without it, whoever signs up on the published site doesn't get the code and can't use the account. Accounts that existed before e-mail confirmation are marked as confirmed.

1. Create a Resend account and, under **API Keys**, generate a key with sending permission.
2. Under **Domains**, add a domain of yours and create the DNS records Resend shows. Without a verified domain, Resend only delivers to your own Resend account's e-mail, so nobody else gets the codes.
3. In the Vercel project, under **Settings → Environment Variables**, create:
   - `RESEND_API_KEY`: the key from step 1;
   - `EMAIL_FROM`: the sender, from a verified domain, such as `StackMatch <nao-responda@yourdomain.com.br>`. Without it, the sender is `onboarding@resend.dev`, which is only good for testing.

The key gives access to sending e-mail on behalf of your domain: the same rules as the connection string apply to it.

## 6. Turn on the daily cleanup and the e-mail retries

Every day, at 03:00 Brasília time, a Vercel Cron calls `/api/cron/cleanup`, which deletes expired sessions, expired e-mail codes, old sign-in failures, e-mail sends, old assistant questions and translation requests, interest marks older than 30 days, typed skills nobody uses anymore, old notifications and the records of finished notification e-mails. At 03:30, another one calls `/api/cron/notifications`, which sends the notification e-mails that failed and are due again (on a Pro plan, set `NOTIFICATIONS_CRON`, such as `*/10 * * * *`, in the build's environment to run it more often). The schedules already come with the deploy; what's missing is the secret that protects the routes:

1. Generate a long random string (for example, with `openssl rand -hex 32`).
2. Under **Settings → Environment Variables**, create `CRON_SECRET` with it, in the **Production** environment.

Vercel sends that secret on every Cron call. Without the variable, the routes refuse everyone: the cleanup doesn't run and failed e-mails are only retried by the site's own requests; the app works the same, it just piles up expired records. Runs show under **Settings → Cron Jobs**.

## 7. Deploy again

The integration doesn't redeploy on its own. Under **Deployments**, open the latest deploy and use **⋯ → Redeploy**.

## 8. Check

On the published site:

1. If you ran the seed, sign in with `teste.emp@example.com` / `teste1234`. Discover should show Gabriel Botelho.
2. Create a new account with an e-mail of yours: the code should arrive, and the account only gets into the app after confirming it. Sign out and sign in again.
3. Under **Forgot my password** (**Esqueci minha senha** in Portuguese), request a code for that account and change the password.
4. As a company, save a talent and reload the page: it stays in Saved talent.
5. As a developer, upload a photo in the profile and finish: in Discover, the photo should come from a `*.public.blob.vercel-storage.com` address.

If something fails, errors show under **Deployments → (deploy) → Logs**. The most common ones:

| Error                                                        | Cause                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL must point to a Postgres server in production` | The variable isn't in the deploy's environment. Check step 1 and redeploy.                           |
| `relation "users" does not exist`                            | The migrations weren't applied to that database. Run step 2.                                         |
| Sign-in doesn't work, with no error in the log               | Check that the deploy came after the database was created (step 7).                                  |
| `No e-mail service: set RESEND_API_KEY`                      | The Resend key isn't in the project. Check step 5 and redeploy.                                      |
| `Resend refused the e-mail (403)`                            | The `EMAIL_FROM` sender isn't from a domain verified in Resend (step 5).                             |
| `No Blob store connected`                                    | The Blob store isn't connected to the project. Check step 4 and redeploy.                            |
| `Profile not saved:` followed by a Blob error                | The project's `BLOB_READ_WRITE_TOKEN` isn't the public store's. Copy the store's token and redeploy. |

## Migrations on deploy

On Vercel, the build runs `npm run vercel-build` when that script exists in `package.json`. It applies the pending migrations and only then builds the site:

- **Production only** (`VERCEL_ENV=production`): preview deploys, from other branches, skip the migrations and don't change the production database.
- **If a migration fails**, or the database doesn't respond within 2 minutes, the build fails and the site stays on the previous version. The reason shows in the build log, under `Migrations failed` or `Migrations timed out`.
- Check under **Settings → Build and Deployment** that the **Build Command** is the default. A custom command makes Vercel ignore `vercel-build`; in that case, use `npm run vercel-build`.

Migrations are applied before the new code goes live, so for a few minutes the old code runs on the already migrated database. That's why a migration has to work with the previous code: creating tables and columns (with a default value or accepting null) can go in a single deploy; deleting or renaming a column takes two, first the code that stops using it and then the migration.

## After changing the schema

1. Change `src/server/db/schema.ts`.
2. Generate the migration with `npm run db:generate` and commit the `drizzle/` folder.
3. On push, the production deploy applies the migration before publishing the code (see above).

Local PGlite applies migrations on its own at startup.
