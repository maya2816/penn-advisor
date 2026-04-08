# Penn Advisor

LLM-assisted degree planning for Penn undergraduates (MVP: **SEAS BSE Artificial Intelligence**). Students upload a Path Penn transcript PDF or add courses manually; the app runs a local degree audit against `programs.json` + `courses.json` and shows progress on a dashboard.

## Quick start (local testing)

```bash
cd penn-advisor
npm install
npm run dev
```

Open **http://localhost:5173/**. The app redirects to **`/setup`** until you pick a program and add at least one course, then **`/dashboard`** shows your audit.

**Advisor chat (Claude API)**

The dashboard sidebar calls **`POST /api/chat`**, which is implemented as a Vercel serverless function in [`api/chat.js`](api/chat.js). Plain **`npm run dev`** does not serve `/api/*`, so use the Vercel CLI for full-stack local testing:

1. Install [Vercel CLI](https://vercel.com/docs/cli) and log in (`vercel login`).
2. Copy `.env.example` to `.env.local` and set **`ANTHROPIC_API_KEY`** (from [Anthropic Console](https://console.anthropic.com/)).
3. From the repo root run (same folder as `.env.local`):

```bash
vercel dev
```

Or: **`npm run dev:full`** (same command). Stop **`npm run dev`** first if it is still running so ports are free.

Open the URL Vercel prints (often **http://localhost:3000**). Use that URL for the app—**not** `localhost:5173`—so `/api/chat` and the UI share one origin. Chat history is stored in `localStorage` under `penn-advisor:chat` and is cleared when you use **Reset** on the dashboard.

Optional: set **`ANTHROPIC_CHAT_MODEL`** in `.env.local` to override the default model in `api/chat.js`.

**If chat shows “missing API key” but `.env.local` is set:** `vercel dev` sometimes does not pass `.env.local` into the API process; [`api/chat.js`](api/chat.js) loads `.env.local` from the project root automatically. Restart `vercel dev` after editing env files.

**If chat fails after “typing” with a billing / credits message:** your Anthropic account needs an active plan or credits ([Plans & Billing](https://console.anthropic.com/settings/plans)). The API returns 400 when the balance is too low—the UI will surface that after a server update.

**Suggested user test path**

1. Clear site data for `localhost` (or use **Reset** on the dashboard) to start fresh.
2. **Program** — select your degree program and optional target graduation term.
3. **Courses** — upload an unofficial transcript PDF or use **Search and add**.
4. **Goals** (optional) — interest chips and optional short free-text note for advising context.
5. **Confirm** — save and open the dashboard.

**Engine smoke tests (terminal)**

```bash
node scripts/sanity.mjs
```

**Production build**

```bash
npm run build
npm run preview   # optional: serve dist/
```

## Git and GitHub

This project is a normal Git repo. If **`git remote -v`** is empty, GitHub (or another host) does not know about it yet—you only have a **local** history.

**1. Create an empty repo on GitHub** (no README/license if you already have commits locally): e.g. `github.com/new` → name `penn-advisor` → create.

**2. Point this folder at it and push** (replace `YOUR_USER`):

```bash
cd "/path/to/penn-advisor"
git remote add origin git@github.com:YOUR_USER/penn-advisor.git
# HTTPS instead: git remote add origin https://github.com/YOUR_USER/penn-advisor.git

git fetch origin
git branch -M main   # optional: rename current branch to main before first push
git push -u origin main
```

If your work is on a feature branch (e.g. `move-grad-term`), either merge it into `main` locally first, or push that branch: `git push -u origin move-grad-term`.

**Connection issues**

- **SSH**: run `ssh -T git@github.com` — if it fails, add an SSH key in GitHub → Settings → SSH keys.
- **HTTPS**: use a [Personal Access Token](https://github.com/settings/tokens) as the password when Git prompts (not your GitHub account password).
- **GitHub CLI**: `gh auth login` then `gh repo create penn-advisor --private --source=. --remote=origin --push` (creates the repo and pushes from the current directory).

## Documentation

- [docs/OVERVIEW.md](docs/OVERVIEW.md) — architecture, data shapes, conventions
- [docs/PLAN.md](docs/PLAN.md) — phase history and status
