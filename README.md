# Penn Advisor

LLM-assisted degree planning for Penn undergraduates (MVP: **SEAS BSE Artificial Intelligence**). Students upload a Path Penn transcript PDF or add courses manually; the app runs a local degree audit against `programs.json` + `courses.json` and shows progress on a dashboard.

## Quick start (local testing)

```bash
cd penn-advisor
npm install
npm run dev
```

Open **http://localhost:5173/**. The app redirects to **`/setup`** until you pick a program and add at least one course, then **`/dashboard`** shows your audit.

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

## Documentation

- [docs/OVERVIEW.md](docs/OVERVIEW.md) — architecture, data shapes, conventions
- [docs/PLAN.md](docs/PLAN.md) — phase history and status
