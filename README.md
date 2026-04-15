# Penn Advisor

An intelligent degree-planning tool for University of Pennsylvania undergraduates. Upload your Penn transcript, see exactly where you stand in your degree, discover minors you're close to completing, and chat with an AI advisor grounded in your actual academic record.

**Try it live:** [penn-advisor-sigma.vercel.app](https://penn-advisor-sigma.vercel.app)

## What it does

Penn students currently piece together their degree picture manually — checking requirements across multiple systems, missing cross-listed equivalencies, and discovering too late that they were one course from a minor. Penn Advisor solves this by combining Penn's course data with a local degree audit engine and an LLM advisor layer.

### Core capabilities

| Feature | Description |
|---|---|
| **Transcript upload** | Drop a Penn transcript PDF → auto-extracts every course, grade, and semester via column-aware parsing |
| **Degree audit engine** | Recursive requirement tree walker with a backtracking solver for the "no double-counting" problem (e.g., CIS 4300 can fill Vision & Language OR AI Project, but not both) |
| **Near-miss minor detection** | Automatically finds minors you're 0–3 CU from completing. *"Did you know you already qualify for the CS minor and the Data Science minor?"* |
| **Prerequisite & mutex awareness** | Flags prereq violations and mutually-exclusive course conflicts as warnings, never blockers |
| **Penn Course Review integration** | Pulls difficulty, workload, and quality ratings from the PCR API — shown on course tiles and used by the AI advisor |
| **Semester timeline planner** | Chronological view of completed → in-progress → planned terms, with per-term difficulty/workload means and an auto-plan generator |
| **AI chat advisor** | Claude-powered assistant grounded in *your* completion state. Knows your prereqs, your gaps, your near-miss minors. Answers with real PCR data. |

### How Penn Advisor fits alongside existing Penn tools

| Tool | What it does | What it's missing |
|---|---|---|
| **Path Penn** | Shows your transcript and GPA | No requirement tracking, no "am I on track?" |
| **Penn Course Plan** | Schedule builder (time conflicts) | Zero awareness of your degree program or completed courses |
| **Penn Course Review** | Ratings and reviews per course | No connection to your degree progress |
| **Penn Degree Plan** | Requirement audit | No intelligence layer, no transcript auto-ingest, no planning |
| **Penn Advisor** | All of the above, integrated, with an LLM brain on top | This project |

## Architecture

```
Penn Transcript PDF
  ↓ (pdfjs-dist, column-aware parser)
Student Profile + Courses
  ↓
Degree Audit Engine (pure, synchronous)
  ├── programs.json (hand-curated requirement tree)
  ├── courses.json (PCR API snapshot + scraped attributes)
  └── assignmentSolver.js (MRV backtracking)
  ↓
CompletionStatus tree
  ├── Dashboard (React, Tailwind, Vite)
  ├── Semester Timeline (chronological planner)
  ├── Near-Miss Minor Analyzer (walks minors.json)
  └── Claude Chat Advisor (Vercel serverless, streaming)
       ├── lookup_course (catalog + PCR ratings)
       ├── lookup_course_reviews (deep PCR data)
       └── find_hidden_opportunities (near-miss minors)
```

**Key design decision:** the engine is a *pure synchronous function*. `computeCompletion(courses, programId)` takes the student's courses and a program ID, returns a structured status tree, and has zero side effects. Everything else — UI, persistence, chat — is plumbing around that core.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS |
| Routing | react-router-dom |
| State | React Context + localStorage |
| PDF parsing | pdfjs-dist (dynamic import, Web Worker) |
| Course data | Penn Course Review API (unauthenticated) + catalog scrape overlay |
| LLM | Anthropic Claude API via Vercel serverless |
| Deployment | Vercel |

## Data sources

| Source | What it provides | How it's ingested |
|---|---|---|
| **Penn Course Review API** (`penncoursereview.com/api/base/`) | Course titles, credits, descriptions, difficulty/workload/quality ratings | Build-time snapshot via `scripts/ingest/fetchPcrCatalog.mjs` |
| **Penn catalog** (`catalog.upenn.edu`) | Prerequisite chains, mutual-exclusion data, SEAS attributes (EUNS, EUSS, EUHS, EUTB) | One-time scrape via `scripts/ingest/` scripts |
| **CIS advising** (`advising.cis.upenn.edu`) | Tech-elective eligibility | `scripts/ingest/normalizeTechElectives.mjs` |
| **Hand-curated** | Program requirement trees, minor requirement trees | Manual modeling from the official Penn catalog |

The program requirement tree (`programs.json`) captures *"what THIS major requires of those courses"* — course pools, exclusive-slot rules, section-title constraints, and writing-seminar tags. This is curriculum-design content maintained by hand, separate from the catalog data.

## Quick start

```bash
git clone https://github.com/maya2816/penn-advisor.git
cd penn-advisor
npm install
npm run dev
```

Open **http://localhost:5173/** → redirects to `/setup`. Pick a program, upload a transcript (or add courses manually), and you'll land on the dashboard.

### AI chat advisor

The chat sidebar requires an Anthropic API key:

```bash
cp .env.example .env.local
# Set ANTHROPIC_API_KEY in .env.local
vercel dev
```

### Engine tests

```bash
node scripts/sanity.mjs
```

7 test cases (A–G): empty student, partial junior, double-counting conflict, tech electives, full 37/37 coverage, prereq violation, mutex conflict.

## Currently modeled

- **Program:** SEAS BSE Artificial Intelligence (37 CU, 2025–26 catalog)
- **Minors:** Mathematics, Computer Science, Data Science, Cognitive Science
- **Courses:** 13,200+ entries (PCR snapshot + catalog scrape)

Adding a new program or minor means writing a new entry in `programs.json` or `minors.json` using the same recursive `Requirement` schema. No engine changes needed.

## Project structure

```
penn-advisor/
├── api/chat.js                    Vercel serverless: Claude advisor with 3 tools
├── src/
│   ├── data/
│   │   ├── courses.json           Flat catalog (13K+ entries, PCR-enriched)
│   │   ├── programs.json          SEAS_AI_BSE requirement tree
│   │   └── minors.json            4 minor requirement trees
│   ├── utils/
│   │   ├── degreeEngine.js        computeCompletion() — the core audit
│   │   ├── assignmentSolver.js    MRV backtracking for exclusive slots
│   │   ├── nearMissAnalyzer.js    findHiddenOpportunities() — minor detection
│   │   ├── transcriptParser.js    PDF → structured course list
│   │   ├── pcrClient.js           Penn Course Review API client
│   │   ├── planGenerator.js       Auto-plan: gap→course, prereq-sort, distribute
│   │   └── ...
│   ├── components/
│   │   ├── Dashboard/             Progress ring, section accordions, timeline cards
│   │   ├── Setup/                 Multi-step wizard (program, courses, goals, confirm)
│   │   ├── Chat/                  Streaming chat sidebar
│   │   └── Layout/                AppShell, route guard
│   ├── state/                     StudentContext, ChatContext
│   └── llm/                       System prompt, advisor context builder
├── scripts/ingest/                Build-time data pipeline (PCR + catalog scrape)
└── docs/                          Architecture notes
```

## License

MIT
