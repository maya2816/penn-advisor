# Penn Advisor — Complete Project Overview

> **Audience for this doc:** any LLM (or human) picking up Penn Advisor
> implementation cold. After reading this you should know what the project
> is, why it exists, how it's architected, what's been built, what's
> missing, what conventions are locked in, and where to look for deeper
> details. **Read this first** before making any change.

> **This doc is the canonical context.** When in doubt, prefer this over
> any half-remembered context from prior conversations. When you change
> something significant, update this doc in the same turn.

---

## 1. Elevator pitch

Penn Advisor is an LLM-powered degree-planning tool for University of
Pennsylvania undergraduates. A student uploads their Penn transcript PDF;
the platform parses it into a structured profile, runs an in-house
"degree audit" engine against the official program requirement tree,
shows a dashboard of progress (with prereq violations and mutual-exclusion
conflicts surfaced as warnings), and lets the student chat with a
Claude-powered advisor that's grounded in their specific completion
state.

The first program modeled is **SEAS BSE Artificial Intelligence**
(37 CU, 2025-26 catalog). The architecture is designed so that adding
more programs (CS BSE, NETS, DMD, minors) is purely a matter of writing
new entries into `programs.json` — no engine changes.

---

## 2. The problem it solves

Penn's degree audit story for undergrads is fragmented:

- **Path Penn** shows you the courses you've taken and your GPA, but it
  does *not* tell you "are you on track for AI BSE."
- **DegreeWorks** technically does this but is famously hard to read,
  and doesn't help with planning ("can I add a Math minor without
  delaying graduation?", "if I switch from Probability via STAT 4300 to
  ESE 3010, what changes downstream?").
- **Academic advisors** are great for nuance but slow to schedule and
  not available on demand.
- **Cross-listed and mutually-exclusive courses** are a constant source
  of accounting errors — students (and even some advisors) miss that
  CIS 4190 / CIS 5190 are the same course.
- **Prerequisite chains** are buried in the catalog HTML; nobody reads
  them ahead of time, so students discover prereq violations after they
  enroll.

Penn Advisor's job is to be the thing a student opens the night before
their advising appointment to walk in informed. Every claim it makes is
grounded in (a) the official Penn course catalog, (b) the official
program requirement tree, and (c) the student's actual transcript.

---

## 3. High-level architecture

```
                  ┌──────────────────────┐
                  │  Penn catalog        │
                  │  + advising lists    │   (scraped offline)
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  src/data/           │
                  │  ├─ courses.json     │   (~12,895 entries)
                  │  ├─ programs.json    │   (recursive Requirement tree)
                  │  └─ raw/             │   (cached HTML, JSON sources)
                  └──────────┬───────────┘
                             │ static import
                             ▼
┌───────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│  Transcript   │──▶│  StudentContext      │──▶│  degreeEngine.js │
│  PDF upload   │   │  (React Context +    │   │  + assignment-   │
│               │   │   localStorage)      │   │    Solver.js     │
└───────────────┘   └──────────┬───────────┘   └────────┬─────────┘
                               │                        │
                               ▼                        ▼
                    ┌──────────────────────┐  ┌──────────────────┐
                    │  Dashboard           │  │  CompletionStatus│
                    │  (Hero ring,         │◀─│  tree            │
                    │   section grid,      │  └──────────────────┘
                    │   warnings, list)    │
                    └──────────┬───────────┘
                               │
                               ▼ (Phase 4 Session B — not yet built)
                    ┌──────────────────────┐
                    │  Right-sidebar Chat  │
                    │  → /api/chat         │
                    │  → Claude API        │
                    │  (system prompt +    │
                    │   completion status  │
                    │   injected)          │
                    └──────────────────────┘
```

The thing to internalize: **the engine is a pure function**.
`computeCompletion(courses, programId)` takes the student's completed
courses and a program ID, returns a structured `CompletionStatus`
object, and has zero side effects. Everything else (UI, persistence,
chat) is plumbing around that pure core.

---

## 4. Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **React 19** + **Vite** (JSX, **no TypeScript**) | Fast dev server. JSX-only because the user explicitly chose it; we mitigate the type-safety loss with thorough JSDoc on `degreeEngine.js`. |
| Routing | **react-router-dom 7+** | `/setup` and `/dashboard`. Route guard `RequireSetup` bounces `/dashboard` to `/setup` if no student data. |
| Styling | **Tailwind CSS 3** + **shadcn/ui** primitives + **plain CSS Modules** for custom widgets | Hybrid Healthcare layout + Fintech data density. See `tailwind.config.js` for Penn-blue color scale. |
| Theme | **Light mode only** for MVP | Locked decision; dark mode deferred indefinitely. |
| Brand color | **Penn blue `#011F5B`** | Penn's official navy. Avoids the "warning" connotation of Penn red in dashboard contexts. |
| State | **React Context** + **`localStorage`** wrapper | No Redux/Zustand. `StudentContext` is the single source of truth. Persistence wrapped behind `src/utils/storage.js`. |
| LLM | **Anthropic Claude API** via `@anthropic-ai/sdk` | Default `claude-sonnet-4-6` for chat; reserve `claude-opus-4-6` for harder planning questions. |
| Serverless | **Vercel Functions** under `/api` | `api/chat.js` (not yet built) will stream Claude responses back. API key stays server-side. |
| PDF parsing | **pdfjs-dist** (legacy build, dynamic import, `?url` worker) | ~1 MB lib, lazy-loaded only when the upload tab is used. Vite emits the worker as a static asset. |
| HTML scraping (offline scripts) | **cheerio** | Used by ingest scripts only. Not in the runtime bundle. |
| Package manager | **npm** | Vite default. |
| Deployment | **Vercel** | Not yet deployed. Local dev only so far. |

**Things explicitly NOT in the stack** (and why):

- **No TypeScript** — user choice; mitigated with JSDoc in the engine.
- **No Redux/Zustand/etc.** — Context + localStorage is plenty for the MVP.
- **No Tailwind component library besides shadcn** — rolling our own
  components keeps the bundle small.
- **No charting library** — the progress ring is hand-rolled SVG (~40
  lines), no `recharts`/`chart.js`.
- **No backend or database** — single-user MVP, everything is in
  `localStorage`.
- **No auth** — single-user MVP.
- **No mobile responsive design** — desktop only for the first MVP. Locked.

---

## 5. Project structure

```
penn-advisor/
├── api/                                  ← Vercel functions (not yet built)
├── docs/
│   ├── PLAN.md                           ← living phase plan (status per phase)
│   └── OVERVIEW.md                       ← this file
├── public/
├── scripts/
│   ├── sanity.mjs                        ← end-to-end engine smoke tests (Cases A-G)
│   └── ingest/
│       ├── normalizeTechElectives.mjs    ← Phase 1: tech electives JSON → courses.json
│       ├── fetchAttribute.mjs            ← Phase 2A: catalog.upenn.edu/attributes/<code>/
│       ├── fetchWritingSeminars.mjs      ← Phase 2A: SEAS handbook writing-courses page
│       ├── scrapeCatalog.mjs             ← Phase 2B: per-course detail scraper (STEM)
│       └── scrapeAllCourses.mjs          ← Phase 4: full A-Z catalog by department
├── src/
│   ├── App.jsx                           ← BrowserRouter + StudentProvider + routes
│   ├── main.jsx                          ← Vite bootstrap
│   ├── index.css                         ← Tailwind directives + .num utility
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppShell.jsx              ← top bar, 1400px container, conditional Reset link
│   │   │   └── RequireSetup.jsx          ← /dashboard route guard
│   │   ├── Setup/
│   │   │   ├── StepProgram.jsx           ← step 1: program picker
│   │   │   ├── StepCourses.jsx           ← step 2: upload + search tabs, semester groups
│   │   │   ├── StepConfirm.jsx           ← step 3: review with stat cards
│   │   │   └── CourseSearch.jsx          ← debounced autocomplete
│   │   ├── Dashboard/
│   │   │   ├── Hero.jsx                  ← circular CU ring + 2x2 stat row
│   │   │   ├── ProgressRing.jsx          ← pure SVG
│   │   │   ├── SectionCard.jsx           ← one of the 6 cards
│   │   │   ├── SectionDetail.jsx         ← slide-out drawer
│   │   │   └── CourseAttribution.jsx    ← flat list: every course → its assigned slot
│   │   └── Chat/                         ← empty (Phase 4 Session B)
│   ├── data/
│   │   ├── courses.json                  ← flat catalog (12,895 entries, ~5 MB)
│   │   ├── programs.json                 ← recursive Requirement tree
│   │   ├── minors.json                   ← {} stub
│   │   └── raw/
│   │       ├── tech_electives_raw.json
│   │       ├── writing_seminars.html
│   │       ├── courses_index.html
│   │       ├── attributes/{euns,euss,euhs,eutb}.html
│   │       ├── catalog_cache/<COURSE_ID>.html  × 729   (Phase 2B per-course)
│   │       └── dept_cache/<dept>.html          × 244   (Phase 4 dept pages)
│   ├── pages/
│   │   ├── SetupPage.jsx                 ← wizard container, 3 steps
│   │   └── DashboardPage.jsx             ← Hero + section grid + drawer + chat slot
│   ├── state/
│   │   └── StudentContext.jsx            ← single source of truth, hydrates from localStorage
│   └── utils/
│       ├── degreeEngine.js               ← computeCompletion(courses, programId) ★ pure
│       ├── assignmentSolver.js           ← MRV backtracking for exclusive slots ★ pure
│       ├── transcriptParser.js           ← PDF → TranscriptData (student + courses)
│       └── storage.js                    ← typed localStorage wrapper
├── tailwind.config.js                    ← Penn-blue tokens, soft status colors
├── postcss.config.js
├── vite.config.js
├── package.json
└── .claude/skills/ui-ux-pro-max/         ← UI UX Pro Max skill (auto-activates on UI work)
```

⭐ The two starred files are the architectural heart. If you understand
`degreeEngine.js` and `assignmentSolver.js`, you understand 80% of the
project.

---

## 6. The data layer

### 6.1 `src/data/programs.json` — the requirement tree

Every degree program is a recursive tree of `Requirement` nodes. **Each
node says "give me N CUs from this pool."** That's the single mental
model — understand it and the entire engine becomes obvious.

```jsonc
{
  "id": "math.calc2",        // dot-namespaced unique id
  "label": "Calculus, Part II",
  "min_cu": 1,                // CUs required at this node
  "from": { "course_ids": ["MATH1410", "MATH1610"] },  // pool the CUs come from
  "exclusive": true,          // (optional) if true, courses used here can't count elsewhere
  "constraints": [...],       // (optional) extra rules
  "children": [...],          // (optional) sub-requirements; turns this into a section
  "note": "human hint"        // (optional) for the UI
}
```

The `from` field has five forms:

| Form | Example | Meaning |
|---|---|---|
| `{ "course_ids": [...] }` | required course or choose-one group | Must come from this explicit list |
| `{ "attribute": "EUNS" }` | Natural Science Elective | Any course tagged with this Penn attribute |
| `{ "attributes": ["EUSS","EUHS"] }` | SS/H pool | Any course with any of these attributes |
| `{ "any": true }` | Free Elective | Literally any course |
| *(omitted)* | parent section | Pool is the union of children |

`constraints` are extra rules that don't fit the basic shape:

| Constraint | Used by |
|---|---|
| `{ "type": "max_cu_at_level", "level": 1000, "cu": 1 }` | Tech Electives (≤ 1 CU of 1000-level) |
| `{ "type": "must_include_tag", "tag": "writing_seminar" }` | SS/H 3-CU bucket |
| `{ "type": "section_title_required", "course_id": "LAWM5060", "value": "Technology Law and Ethics" }` | LAWM 5060 conditional → AI Ethics |

The currently-modeled program is `SEAS_AI_BSE` (37 CU). The full tree
has 6 sections: Computing (5 CU), Math and Natural Science (7 CU),
Artificial Intelligence (12 CU), Senior Design (2 CU), Technical
Electives (3 CU), General Electives (8 CU).

### 6.2 `src/data/courses.json` — the catalog

Flat dictionary keyed by no-space course ID (`"CIS1100"`, `"WRIT0020"`).
Every entry has the same shape:

```jsonc
{
  "id": "CIS4230",
  "title": "Ethical Algorithm Design",
  "cu": 1,
  "level": 4000,                       // first digit × 1000 (CIS1100 → 1000)
  "attributes": ["TECH_ELECTIVE","EUTB"],
  "prerequisites": ["CIS1210"],
  "mutuallyExclusive": ["CIS5230"],
  "tech_elective_status": "unrestricted",  // null | "unrestricted" | "restricted" | "ask"
  "tags": []                            // free-form, e.g. "writing_seminar"
}
```

**12,895 entries** as of 2026-04-08. Built from these sources, each
ingested by an idempotent script in `scripts/ingest/`:

| Source | URL | Script | Yield |
|---|---|---|---|
| CIS tech electives | `advising.cis.upenn.edu/assets/json/37cu_csci_tech_elective_list.json` | `normalizeTechElectives.mjs` | 362 courses tagged `TECH_ELECTIVE` |
| EUNS attribute | `catalog.upenn.edu/attributes/euns/` | `fetchAttribute.mjs euns` | 312 courses |
| EUSS attribute | `catalog.upenn.edu/attributes/euss/` | `fetchAttribute.mjs euss` | 1,324 courses |
| EUHS attribute | `catalog.upenn.edu/attributes/euhs/` | `fetchAttribute.mjs euhs` | 4,503 courses |
| EUTB attribute | `catalog.upenn.edu/attributes/eutb/` | `fetchAttribute.mjs eutb` | 64 courses |
| Writing seminars | `ugrad.seas.upenn.edu/student-handbook/.../writing-courses/` | `fetchWritingSeminars.mjs` | 49 courses tagged `writing_seminar` |
| Per-course detail (STEM) | `catalog.upenn.edu/search/?P=<DEPT>%20<NUMBER>` | `scrapeCatalog.mjs` | Prereqs + mutex for 729 STEM courses |
| Full A-Z by department | `catalog.upenn.edu/courses/<dept>/` × 244 | `scrapeAllCourses.mjs` | 6,653 new + 1,184 updated entries; gives complete catalog coverage |

**Key invariants:**
- Course IDs are normalized to no-space format (`"CIS1100"`, never `"CIS 1100"`).
- All ingest scripts are **idempotent** — re-running them produces the
  same output. They auto-migrate every existing entry to the latest
  schema before merging.
- HTML/JSON responses are cached in `src/data/raw/` so re-runs are
  instant. Pass `--force` to bypass the cache.
- Cross-listed undergrad/grad pairs (`CIS 4190 ↔ CIS 5190`) live in the
  same pool **and** are flagged as `mutuallyExclusive` of each other.

### 6.3 The Penn attributes vocabulary

Penn uses these official catalog attributes (all 4-character codes
starting with `EU` for SEAS):

| Code | Meaning |
|---|---|
| `EUNS` | SEAS Natural Science |
| `EUSS` | SEAS Social Science |
| `EUHS` | SEAS Humanities (NOT EUHM — common mistake) |
| `EUTB` | SEAS Tech, Business, Society (NOT EUTBS) |
| `EUNG` | SEAS Engineering (we don't ingest this separately; it's covered by `TECH_ELECTIVE`) |

`TECH_ELECTIVE` is **our** synthetic attribute — it represents "things
the CIS department accepts as a tech elective per
`advising.cis.upenn.edu`," which is the canonical source of truth for
the Tech Electives requirement.

`writing_seminar` is **our** synthetic tag (not an attribute) for the
~49 courses on the SEAS writing-courses page, used by the
`must_include_tag` constraint inside the SS/H 3-CU requirement.

---

## 7. The engine

### 7.1 `src/utils/degreeEngine.js`

```js
/**
 * @param {StudentCourse[]} completedCourses  Array of { id, semester?, ... }
 * @param {string}          programId         e.g. "SEAS_AI_BSE"
 * @returns {CompletionStatus}
 */
export function computeCompletion(completedCourses, programId) { ... }
```

Pipeline (this is the order to read the function in):

1. **Normalize student courses** — for each course, look up the catalog
   entry, merge `attributes` and `tags` so attribute-based pools work
   even if the student input didn't repeat them.
2. **Flatten the program tree to leaves** — walk the requirement tree,
   collect every node with a `from` field and no `children`.
3. **Split leaves into "solver slots" vs "engine-filled"** — leaves
   marked `exclusive: true` with explicit `course_ids` pools become
   solver slots; everything else (attribute pools, free electives,
   single-course required leaves) is filled greedily.
4. **Run the assignment solver** on the exclusive slots → returns
   `{assignments: {courseId → slotId}, conflicts: [...]}`.
5. **Greedy fill** for non-exclusive leaves, in tree order, applying
   constraints (`section_title_required`, `must_include_tag`,
   `max_cu_at_level`).
6. **Compute prereq violations** — for every completed course, check
   that every entry in its `prerequisites` is also in the student's
   completed set. Surface as `prereqViolations: [{courseId, missing}]`.
7. **Compute mutex conflicts** — O(N²) pair check across student
   courses, looking for `mutuallyExclusive` matches. Surface as
   `mutexConflicts: [{courseA, courseB}]`.
8. **Walk the tree bottom-up** building a `RequirementStatus` tree
   with completedCu/requiredCu/status per node.
9. Return `CompletionStatus`.

The returned shape:

```js
{
  programId: "SEAS_AI_BSE",
  programName: "Artificial Intelligence, BSE",
  totalCuRequired: 37,
  totalCuCompleted: 17,
  root: { id, label, requiredCu, completedCu, status, satisfiedBy, children },
  unassignedCourses: [...],     // student courses no slot consumed
  conflicts: [...],             // solver couldn't decide between candidates
  warnings: [...],              // soft constraint failures (writing seminar missing, etc.)
  prereqViolations: [...],
  mutexConflicts: [...],
}
```

**Important**: prereq violations and mutex conflicts are surfaced as
**warnings, never blockers.** The slot still completes; the dashboard
shows a chip; the LLM can ask the student what to do. We never silently
drop a course or refuse to compute completion.

### 7.2 `src/utils/assignmentSolver.js`

The "no double-counting" problem: a course like `CIS 4300` is in BOTH
the AI section's "Vision & Language" pool AND the "AI Project" pool. It
can only fill one. When a student takes both `CIS 4300` and `CIS 5300`,
the engine has to assign each to a distinct slot.

Algorithm: **most-constrained-first backtracking** (the standard MRV
heuristic for CSPs).

1. Honor user pins first (the `pinnedSlot` field on `StudentCourse`).
   No UI to set pins yet, but the data path is wired.
2. For the remaining courses, repeatedly:
   - Find the course with the fewest legal slots (most constrained).
   - For each legal slot, recurse with that course placed there.
   - Track the best (max-coverage) assignment seen.
3. Return `{assignments, conflicts, unassigned}`.

This is correct + fast for our problem size (≤40 courses, ≤15 exclusive
slots). Don't overthink it — the bipartite matching alternative is
overkill.

**Cosmetic bug to avoid re-introducing:** the conflict report previously
listed already-consumed courses as "candidates" for unsatisfied slots,
which made the dashboard show stale warnings. The fix is to filter
`eligible` to only courses NOT in `assignments`. See lines ~125-140 in
`assignmentSolver.js`.

---

## 8. Setup wizard (current state)

### 8.1 Two tabs in step 2

Step 2 ("Add your completed courses") has **only two tabs** as of
2026-04-08 — the paste-transcript tab was deleted because Penn
transcript PDFs aren't copy-paste friendly (the column layout scrambles
when you select text):

1. **Upload transcript** (default) — drag-and-drop or click the
   dropzone, calls `parseTranscriptPdf()` from `transcriptParser.js`.
2. **Search and add** — debounced autocomplete against `courses.json`
   for manually adding courses.

### 8.2 The transcript parser

`src/utils/transcriptParser.js` is the single entry point for PDF
processing. One public function:

```js
export async function parseTranscriptPdf(input)
  // input: File | Blob | ArrayBuffer | Uint8Array
  // returns: TranscriptData
```

`TranscriptData` shape:

```js
{
  student: {
    name: "Maya Kfir",
    pennId: "22194222",
    program: "School of Engineering and Applied Science - Bachelor of Science in Engineering",
    major: "Artificial Intelligence",
    dateIssued: "26-MAR-2026",
  },
  totals: {
    earnedHrs: 25.5,
    gpaHrs: 25.5,
    qualityPoints: 92.75,
    gpa: 3.64,
    inProgressCu: 6,
  },
  courses: [
    { id: "CIS1100", title: "Intro To Comp Prog", cu: 1, grade: "A+",
      inProgress: false, inCatalog: true, semester: "Fall 2023" },
    ...
  ],
  bySemester: { "Fall 2023": [...], "Spring 2024": [...], ... },
  rawText: "...",   // for debugging
}
```

Five things make this parser work where naive ones fail:

1. **Dynamic pdfjs import** — keeps the bundle slim. Worker URL via
   Vite's `?url` import suffix.
2. **Two-column extraction** — Penn transcripts use a two-column
   layout. We split items by x-coordinate at `x=350` and process each
   column independently top-to-bottom. Otherwise left/right courses
   interleave on the same y-line and semester headers get scrambled.
3. **Skip empty pdfjs items** — pdfjs emits empty-string spacing items
   between adjacent text items; if you include them, "CIS" + "" +
   "1100" joins to "CIS  1100" (two spaces) and breaks the regex.
4. **Multi-space-tolerant regex** — `[A-Z]{2,5}\s*\d{3,4}` (zero-or-more
   whitespace), not `\s?` (zero-or-one).
5. **Single-pass linear semester tracking** — walk the text line by
   line, watch for `Fall|Spring|Summer YYYY` headers, tag every
   subsequent course. This is why the column-aware extraction matters
   so much — semester headers must appear in reading order before their
   courses.
6. **Retakes** — the parser keeps the **first** row per course id and
   ignores later rows with the same code. If you need “last grade wins,”
   change `extractCourses` to replace instead of `continue` on `seen`.

**Result on the test transcript** (`Maya_Kfir_UT_2026-03-26T17_35_32.pdf`):
32 of 32 courses parsed, 31 in catalog, 1 unknown (`MEAM 4600`, a
brand-new course Penn hasn't published yet — handled via the "Add
anyway" placeholder UX).

### 8.3 Wizard data flow

```
StepProgram → setPickedProgram(programId)
StepCourses → setDraftCourses([{id, semester, cu, grade, inProgress}])
            → setDraftProfile({name, pennId, gpa, ...})  // merged on PDF parse
StepGoals   → optional careerInterests + targetGraduationTerm on profile
StepConfirm → onConfirm()
            → StudentContext.setProgramId(...)
            → StudentContext.setCompletedCourses(...)
            → StudentContext.setProfile(...)
            → navigate("/dashboard")
```

`StudentContext` persists everything to `localStorage` via
`storage.js` and recomputes `completion` only when its inputs actually
change (memoized).

---

## 9. Dashboard (current state)

`src/pages/DashboardPage.jsx` composes:

- **Hero** (`Hero.jsx`) — circular CU progress ring + 2×2 stat grid
  (sections complete, courses on file, warnings, CUs remaining)
- **Section grid** — 6 cards (Computing, Math/Sci, AI, Senior Design,
  Tech Electives, General Electives), each with a progress bar, status
  pill, and inline warning chip if any prereq violation or mutex
  conflict touches a course in that section
- **CourseAttribution** — flat 2-column list of every course the
  student entered, sorted by section, showing each course's current
  assignment (or "Unassigned" for courses outside the program)
- **SectionDetail drawer** — slides in from the right when a section
  card is clicked, shows each leaf with its progress and the courses
  filling it
- **Chat sidebar slot** — currently a placeholder card on the right;
  reserved layout so the future chat panel doesn't shift the page

**Warning bucketing**: the engine emits flat `prereqViolations` and
`mutexConflicts` arrays with course IDs but no section labels.
`DashboardPage.jsx` does the bucketing in a `useMemo` — walks the tree
once to map each course → its consuming section, then counts warnings
per section card.

---

## 10. Phase progress

Read `docs/PLAN.md` for the canonical phase status (it's a living doc).
Quick summary as of 2026-04-08:

| Phase | Status | One-line description |
|---|---|---|
| **Phase 1** | ✅ Done | Schema enrichment + tech electives ingest |
| **Phase 2A** | ✅ Done | Catalog attribute ingest (EUNS, EUSS, EUHS, EUTB) + writing seminars |
| **Phase 2B** | ✅ Done | Per-course detail scraper for prereqs + mutex (STEM, 729 courses) |
| **Phase 3** | ✅ Done | Engine surfaces `prereqViolations` and `mutexConflicts` |
| **Phase 4 catalog expansion** | ✅ Done | Full A-Z scrape via `scrapeAllCourses.mjs` (6,242 → 12,895 entries) |
| **Phase 4 transcript fixes** | ✅ Done | Column-aware PDF, multi-space regex, semester tagging |
| **Phase 4 setup polish** | ✅ Done | Removed paste tab, unified parser as `transcriptParser.js`, profile in StudentContext |
| **Phase 4 Session A** | ✅ Done | Vite + Tailwind + shadcn + react-router + UI/UX Pro Max + setup wizard + dashboard |
| **Phase 4 Session B** | 📋 Next | Vercel `api/chat.js` + Claude advisor (streaming, persistent history, suggested prompts) |
| **Phase 5+** | 📋 Later | Multi-program support (CS BSE, NETS, DMD, minors), pin UI for course-to-slot overrides, recommended-next-semester logic |

### Phase 4 Session B detail (the immediate next step)

Files to create:

- `api/chat.js` — Vercel serverless function. Reads `{messages,
  completionStatus}` from request body, builds the system prompt via
  `buildSystemPrompt()`, calls
  `anthropic.messages.create({model: "claude-sonnet-4-6", stream: true, system, messages, tools: [lookupCourseTool]})`,
  pipes the streaming response back as Server-Sent Events.
- `src/llm/systemPrompt.js` — exports `buildSystemPrompt(completionStatus)`.
  See section 11 below for the exact prompt strategy.
- `src/state/ChatContext.jsx` — message history + `send(text)` +
  streaming state, persisted to localStorage.
- `src/components/Chat/ChatSidebar.jsx` — right-column container.
- `src/components/Chat/MessageList.jsx` — scrollable container with
  auto-scroll on new.
- `src/components/Chat/MessageBubble.jsx` — user vs assistant styling.
- `src/components/Chat/InputBar.jsx` — autosize textarea + send button +
  AI disclaimer line.
- `src/components/Chat/SuggestedPrompts.jsx` — 3 cards on first load
  with these locked prompts (do not invent new ones):
  - "How many credits do I have left in each requirement?"
  - "What major can I complete using my current courses?"
  - "Help me plan my 4-year degree plan"
- `src/components/Chat/useChatStream.js` — hook that POSTs to
  `/api/chat` with `{messages, completionStatus}`, parses the SSE
  stream, appends tokens to the assistant message.
- `.env.local` — `ANTHROPIC_API_KEY=...` (gitignored)

Required: AI disclaimer below the chat input: *"AI can make mistakes.
Always verify with your academic advisor before making decisions."*

Use `vercel dev` (not `npm run dev`) for local testing so `/api/chat`
is reachable.

---

## 11. LLM advisor strategy (Phase 4 Session B)

This is **prompting + context injection + tool use**, not fine-tuning.
The dataset is one student at a time, the rules change every catalog
year, and the right answer is deterministic given the engine output.
Fine-tuning would freeze knowledge that needs to stay fresh.

### 11.1 Model selection

- **Default: `claude-sonnet-4-6`** for chat. Cheap, fast, plenty smart
  for "explain my degree status" Q&A.
- **Reserve `claude-opus-4-6`** for harder paths: "build me a multi-
  semester plan", "find the optimal way to fit a minor in 2 years."

### 11.2 System prompt structure

Three sections, in order, kept under 2K tokens of static content:

**a) Role + voice** (5-10 lines):
> You are Penn Advisor, a helpful degree-planning assistant for
> University of Pennsylvania undergraduates. You speak plainly, you cite
> courses by their full code (CIS 4190 not "Applied ML"), you never
> invent course numbers or requirements. When you don't know, say so.

**b) Hard rules** (one bullet each):
- Always ground answers in the `<completion_status>` block. Never
  invent requirements that aren't in `programs.json`.
- When a student asks "what should I take next semester?", explicitly
  check `prereqViolations` and propose courses that satisfy unmet
  leaves AND whose prereqs are in the student's completed list.
- When a student has a `mutexConflicts` entry, ask which one they'd
  like to keep — never silently pick.
- When `tech_elective_status` is `"ask"`, tell the student to verify
  with their advisor before assuming the course counts.
- Never recommend a course that already appears in `unassignedCourses`
  for a slot it can't fill.
- Use `EUNS`, `EUSS`, `EUHS`, `EUTB` as Penn's official attribute codes
  — no made-up names like "Humanities Elective" unless quoting a label
  from the requirement tree.

**c) Output format**: short, scannable, course codes bolded, no
markdown tables unless explicitly asked.

### 11.3 Context injection (the "training" part)

On every chat turn, the serverless function injects a compact XML block
built from `computeCompletion()`. **Only the summary**, not the full
6,242-entry `courses.json` or the full requirement tree:

```xml
<completion_status program="SEAS_AI_BSE" totalCu="36/37">
  <unmet>
    <leaf id="math.natsci" label="Natural Science Elective" requiredCu="1" />
  </unmet>
  <partial>
    <leaf id="ai.electives" label="AI Electives" requiredCu="6" completedCu="3" />
  </partial>
  <warnings>
    <prereq_violation course="CIS4190" missing="CIS1210" />
    <mutex_conflict a="CIS4190" b="CIS5190" />
  </warnings>
  <recently_completed>CIS4190, CIS5300, ESE3040, ESE2100</recently_completed>
  <student name="Maya Kfir" gpa="3.64" />
</completion_status>
```

### 11.4 Tool use for catalog lookups

Define one tool: `lookup_course(course_id)` returning
`{title, cu, prerequisites, mutuallyExclusive, attributes, tech_elective_status}`.
The serverless function backs it with a direct read from
`courses.json`. This lets the model fetch course details on demand
instead of carrying the whole catalog in the prompt.

### 11.5 Evaluation suite (the most important part)

Before shipping, build a small JSONL eval suite of (student state,
question, expected behavior) triples. Run it on every prompt change.
Aim for ~20 cases initially:

- **Prereq awareness**: junior with CIS4190 but no CIS1210 asks "what
  should I take next?" → expect the model to mention the missing
  prereq, not silently recommend CIS3200.
- **Mutex awareness**: student with both CIS4190 and CIS5190 asks "am I
  done with ML?" → expect the model to flag the duplication and ask
  which one to keep.
- **Attribute literacy**: student asks "what counts as a tech
  elective?" → expect a coherent answer referencing the
  TECH_ELECTIVE list and the unrestricted/restricted/ask distinction.
- **Refusal**: student asks "what's the chemistry curriculum?" → expect
  "I only know SEAS AI BSE right now" rather than fabrication.
- **"What major can I complete?"** → expect "I currently only know
  SEAS AI BSE — multi-program comparison is coming soon. Here's how
  you're doing on AI BSE." (Honest until more programs are loaded.)

---

## 12. How to verify the platform yourself

All commands are read-only and safe.

### Run the engine smoke tests

```bash
cd "/Users/mayakfir/Documents/05 Recruitment/penn-advisor"
node scripts/sanity.mjs
```

Should print 7 cases (A-G) ending in `Total CU: 37 / 37` for case E.

### Inspect a specific course (proves the full ingest pipeline)

```bash
node -e '
const c = JSON.parse(require("fs").readFileSync("src/data/courses.json","utf8"));
console.log(JSON.stringify(c["CIS4230"], null, 2));
'
```

Expected: `{ id, title: "Ethical Algorithm Design", cu: 1,
attributes: ["TECH_ELECTIVE","EUTB"], prerequisites: ["CIS1210"],
mutuallyExclusive: ["CIS5230"], ... }`.

### Re-run any ingest step (idempotent, safe)

```bash
node scripts/ingest/normalizeTechElectives.mjs
node scripts/ingest/fetchAttribute.mjs euns      # cached, instant
node scripts/ingest/fetchWritingSeminars.mjs     # cached, instant
node scripts/ingest/scrapeCatalog.mjs            # 729 cached, instant
node scripts/ingest/scrapeAllCourses.mjs         # 244 dept pages cached, instant
```

### Test the transcript parser end-to-end (Node-side)

The browser-side parser uses Vite's `?url` worker import which doesn't
work in Node. To test in Node, set `workerSrc` manually:

```bash
node --input-type=module -e '
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
pdfjs.GlobalWorkerOptions.workerSrc = fileURLToPath(import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"));
// ... then mirror the column-extraction logic from transcriptParser.js
'
```

### Run the dev server

```bash
npm run dev
# open http://localhost:5173/
```

If you've reset `localStorage`, you'll land on `/setup` and walk
through the wizard. To reach `/api/chat` you'll need `vercel dev`
instead (after Phase 4 Session B exists).

### Inspect the canonical living plan

```bash
cat docs/PLAN.md
```

---

## 13. Conventions and locked decisions

These are decisions made during the build that should not be revisited
without an explicit user request:

### Data conventions

- **Course IDs are no-space format**: `"CIS1100"`, never `"CIS 1100"`.
  All ingest scripts normalize on input.
- **Penn attribute codes**: `EUNS`, `EUSS`, `EUHS`, `EUTB`. NOT
  `EUHM`/`EUTBS` — those are wrong.
- **General Electives = 8 CU** in the AI BSE program (not 7).
  5+7+12+2+3+8 = 37 total.
- **Cross-listed pairs** (CIS 4190/5190 etc.) live in the same `course_ids`
  pool AND are mutex of each other. Both are intentional.
- **Catalog title is authoritative.** When ingest scripts merge from
  multiple sources, the per-course detail page wins for `title` and
  `cu`. Tech-electives JSON only sets `attributes` and
  `tech_elective_status`.

### Engine conventions

- **Prereq violations and mutex conflicts are warnings, not blockers.**
  The slot still completes, the dashboard shows a chip, the LLM
  explains. Never silently drop a course.
- **The solver picks the optimal assignment automatically.** A future
  pin UI exists in the data layer (`pinnedSlot`) but no UI is wired —
  decided to defer; the chat advisor handles the rare override case
  verbally.
- **Prereq pointers to non-existent courses** (e.g., CIS 3200 referencing
  the renamed CIS 2620) are reported as "missing" without a special
  data-quality channel. Downstream consumers decide what to render.

### UI conventions

- **Hybrid Healthcare layout + Fintech data density.** Soft rounded
  cards, generous whitespace, monospace numerals (`.num` utility class),
  Penn blue `#011F5B` for primary actions and the progress ring.
- **Light mode only.** Dark mode deferred indefinitely.
- **Desktop only.** No mobile breakpoints in this phase.
- **Section progress is capped per leaf when rolling up to parents.**
  See `buildStatus()` in `degreeEngine.js` — the parent's `completedCu`
  uses `Math.min(child.completedCu, child.requiredCu)` so taking 9 CU
  in a 6-CU section doesn't inflate the total.

### Style conventions for new code

- **Explain every new file in one sentence as you create it.** This is
  an explicit user request — they want to understand each piece. When
  introducing a new module, narrate what it does.
- **Pause at phase boundaries and ask for direction.** Don't auto-chain
  phases. Summarize what changed, list known issues, propose the next
  step.
- **Use `AskUserQuestion` for forks, not for approval.** If there's a
  real architectural fork, ask. If it's a clear next step within an
  approved phase, just do it.
- **Save plans to disk.** `docs/PLAN.md` is the canonical living plan;
  update it as phases complete. `~/.claude/plans/` is for session
  scratch.
- **Surprising findings are valuable.** When the engine surfaces a
  real issue (e.g., the ESE 4020 / STAT 4300 prereq edge case), frame
  it as a discovery, not a bug. The project's value depends on that
  kind of insight.
- **Don't add features beyond what was asked.** The user has specific
  preferences and explicitly asked for incremental work.

---

## 14. Known issues and open questions

### Known issues

1. **Bundle size: ~2.5 MB** because `courses.json` (12,895 entries,
   5 MB raw) is statically inlined. Acceptable for MVP. To fix:
   `import("./courses.json")` dynamic import, OR fetch from a static
   CDN URL at runtime.
2. **MEAM 4600** ("AI for Science and Engineering") is not in Penn's
   public catalog yet. The placeholder UX handles it gracefully —
   students can add it as an unassigned placeholder. Will resolve
   automatically when Penn updates the catalog and we re-run
   `scrapeAllCourses.mjs --force`.
3. **12 historic catalog gaps** (CIS 2210, CIS 3310, CIS 3410, ENGR
   1010, ENGR 2900, ENGR 2990, ESE 3100, ESE 4440, ESE 5040, ESE 5440,
   STAT 4740, STAT 4920) — mostly renamed/retired courses, plus the
   `CIS 2210` typo from the tech-electives source. Harmless.
4. **`vercel dev` is not yet set up.** `/api/chat` won't be reachable
   under `npm run dev` once Phase 4 Session B lands.

### Open questions for future implementation turns

1. **Multi-program support.** The "What major can I complete?"
   suggested chat prompt requires more programs in `programs.json`
   (CS BSE, NETS, DMD, etc.). Each program is ~2 hours of hand-modeling
   from the catalog PDF. Until then, the LLM's honest answer is "I
   currently only know SEAS AI BSE."
2. **Per-semester GPA extraction.** The transcript parser pulls
   cumulative GPA but not per-semester GPA. Easy 10-line addition to
   `transcriptParser.js` if you want to show a GPA trend.
3. **Recommended-next-semester logic.** Currently the engine doesn't
   compute "what should I take next?". This is a Phase 5+ feature that
   would walk unmet leaves, find courses whose prereqs are satisfied,
   and rank by some heuristic (criticality, prereq depth, term
   availability).
4. **Goals collection step.** Career interest (multi-select) + target
   graduation semester would be high-value additions to the wizard for
   the chat advisor. See section 15 for the recommendation.

---

## 15. Recommended next steps for setup wizard expansion

Based on the design conversation, here's what's worth adding to Setup
beyond what's already built. Auto-extracted fields are zero-cost and
should be surfaced on the dashboard. The Goals step is the highest-
leverage manual addition.

### Already extracted but not yet surfaced (free wins)

- **Earned hours / GPA hours / quality points** — show "Year 3 student"
  badge based on earned hours
- **Date issued** — stale-data warning if > 3 months
- **In-progress credit count** — "currently enrolled in 6 CU" stat
- **Per-course grade** — color-code dashboard rows; chat can answer
  "show me the courses I struggled with"

### Recommended new wizard step ("Goals")

Insert between Courses and Confirm:

- **Career interest** (multi-select chips, ≤3): `AI Research`,
  `Software Engineering`, `Quant Finance`, `Robotics`, `Product`,
  `Healthcare AI`, `Startup founder`, `Grad school`, `Not sure yet`
- **Target graduation semester** (dropdown defaulting to "4 years from
  your first term")

Both go into `StudentContext.profile`. The chat advisor will use them
heavily for personalized recommendations.

### Explicitly out of scope

- Email / contact info (no auth, no notifications)
- Birth date / demographics (privacy risk, no model uses it)
- Schedule constraints (out of scope until Phase 6+ scheduler)
- Past transcripts from other institutions (Penn's transcript already
  includes transfer credit)

---

## 16. Pointers to deeper details

When you need more depth than this overview provides, look here:

| Topic | File |
|---|---|
| Phase-by-phase status with results and bug fixes | `docs/PLAN.md` |
| Original Step 2 plan and decision rationale | `~/.claude/plans/rippling-noodling-dongarra.md` |
| LLM strategy memory | `~/.claude/projects/-Users-mayakfir-Documents-05-Recruitment-penn-advisor/memory/project_llm_advisor_strategy.md` |
| Project memory (overview, key decisions) | `~/.claude/projects/-Users-mayakfir-Documents-05-Recruitment-penn-advisor/memory/project_penn_advisor.md` |
| User collaboration style memory | `~/.claude/projects/-Users-mayakfir-Documents-05-Recruitment-penn-advisor/memory/feedback_user_collaboration_style.md` |
| Engine implementation | `src/utils/degreeEngine.js` (~340 lines, JSDoc-typed) |
| Solver implementation | `src/utils/assignmentSolver.js` (~145 lines) |
| Transcript parser | `src/utils/transcriptParser.js` |
| The AI BSE requirement tree | `src/data/programs.json` |
| Engine smoke tests | `scripts/sanity.mjs` (Cases A-G) |
| Original AI BSE catalog source | `/Users/mayakfir/Documents/05 Recruitment/penn-academic-advisor/docs/artificial-intelligence-bse.pdf` |
| Test transcript | `/Users/mayakfir/Downloads/Maya_Kfir_UT_2026-03-26T17_35_32.pdf` |

---

## 17. Sanity checks before any non-trivial change

Before changing something significant, verify the current state with:

```bash
# 1. All 7 sanity cases still pass
node scripts/sanity.mjs | grep "Total CU"

# 2. Bundle still builds
npx vite build && rm -rf dist

# 3. Dev server still boots
npm run dev   # ctrl-C after seeing "ready in N ms"

# 4. courses.json is well-formed
node -e 'JSON.parse(require("fs").readFileSync("src/data/courses.json","utf8"))'

# 5. programs.json is well-formed
node -e 'JSON.parse(require("fs").readFileSync("src/data/programs.json","utf8"))'
```

If any of these fail before you start, fix them first — don't pile new
work on a broken baseline.

---

*Last updated: 2026-04-08, after Phase 4 setup polish (paste tab
removed, transcript parser unified into `transcriptParser.js`,
profile field added to StudentContext).*
