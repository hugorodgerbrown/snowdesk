# SnowDesk

Daily avalanche briefings for the Swiss Alps, delivered by email.

## Stack

- **Next.js 14** (App Router)
- **Supabase** — subscriber database
- **Anthropic Claude** — bulletin analysis
- **Resend** — transactional email
- **Vercel** — hosting + cron jobs

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_ADDRESS` | A verified sender address in Resend |
| `CRON_SECRET` | Any random string (e.g. `openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |

### 3. Create the database tables

Open the Supabase SQL editor and run the SQL from `src/lib/supabase.ts`
(the schema is in the comment block at the bottom of that file).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
src/
  app/
    page.tsx                  ← Sign-up form (React)
    layout.tsx                ← Root layout
    api/
      subscribe/route.ts      ← POST /api/subscribe
      confirm/route.ts        ← GET  /api/confirm?token=...
      unsubscribe/route.ts    ← GET  /api/unsubscribe?token=...
      cron/send/route.ts      ← GET  /api/cron/send  (Vercel cron)
  lib/
    supabase.ts               ← Supabase clients + schema SQL
    bulletin.ts               ← SLF bulletin fetcher
    analyse.ts                ← Claude analysis
    email.ts                  ← Email template + Resend sender
  types/
    index.ts                  ← Shared types + REGION_MAP
vercel.json                   ← Cron schedule (08:15 + 17:15 CET)
```

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create snowdesk --public --push
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Add all environment variables from `.env.local.example`
   (set `NEXT_PUBLIC_APP_URL` to your production domain)
4. Deploy

### 3. Cron jobs

`vercel.json` configures two cron jobs:
- `15 7 * * *`  → 07:15 UTC = **08:15 CET** (morning slot)
- `15 16 * * *` → 16:15 UTC = **17:15 CET** (evening slot)

Vercel calls `/api/cron/send` with an `Authorization: Bearer <CRON_SECRET>` header.
Cron jobs require a **Vercel Pro** plan — on the free Hobby plan you can trigger
the endpoint manually with:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/send
```

### 4. Custom domain

Vercel dashboard → your project → Settings → Domains → Add domain.

---

## Swap in the styled sign-up page

The sign-up page in `public/signup.html` is the full styled version.
To use it instead of the React page:

1. Rename `public/signup.html` → `public/index.html`
2. Update the form's `fetch` call from `#` to `/api/subscribe`
3. Delete `src/app/page.tsx` — Next.js will serve the static HTML instead

Or, convert `signup.html` into a proper React component inside `page.tsx` for
full type safety and server-side rendering.

---

## Testing the cron job locally

```bash
# Start dev server
npm run dev

# In another terminal, trigger the cron endpoint
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/send
```
