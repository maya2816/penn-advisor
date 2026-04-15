# Penn Advisor — Penn Courses API Integration & Slot-Based Planner

> **This plan answers four questions** the user posed about (1) the data
> source decision, (2) data gaps, (3) the slot-based semester planner
> redesign, and (4) the minimum-disruption migration path.
>
> **Status (2026-04-09):** Plan approved. Locked decisions:
> - **Build Phases 1–3 only.** Phase 4 (slot redesign) and Phase 5
>   (cutover) are deferred until after Phases 1–3 ship and the user
>   has tested the chat enrichment.
> - **Slot model = pure UI projection** when Phase 4 eventually starts.
>   The engine continues operating at leaf granularity.
> - **DnD library = `@dnd-kit/core`** for Phase 4 (not relevant yet).
> - **Phase 3 has a new headline requirement**: the chat advisor must
>   answer *"what am I close to that I don't know about?"* as a
>   first-class query — proactively surfacing near-miss minors and
>   attribute optimizations from the student's completion state. See
>   the expanded Phase 3 section below.
>
> **The Penn Labs pitch (sharpened by the user):** *"You already built
> this. It doesn't work. I built a working version with an LLM layer
> on top. Let's finish what you started."* Penn Degree Plan exists at
> a URL but crashes on first interaction; nobody at Penn has heard of
> it because it's effectively abandoned. Penn Advisor is the working
> completion of the same idea, with the LLM layer Penn Labs never
> built.

---

## Context

Penn Advisor is being prepared for adoption by **Penn Labs** — Penn's
official student-run software organization that builds and ships tools
to the entire student body (Penn Course Review, Penn Course Plan, Penn
Course Alert, Penn Degree Plan, Penn Mobile). Adoption is the
distribution path: shipping through Penn Labs is the difference between
"a tool a few people find" and "a tool every Penn student uses."

We are **building a working demo** at a real URL. We are not pitching
yet; we are de-risking the data architecture so the demo holds up
under inspection.

The user has asked four specific questions. The rest of this document
is structured as direct answers to each one, with a step-by-step
implementation plan at the end.

---

## What I learned from the research (the framing changes)

Two findings reshape the architecture answer significantly:

### Finding 1: Most PCR endpoints are unauthenticated

The user said *"the API requires Penn SSO authentication (Bearer token)"*. This
is **only partially true.** Reading the OpenAPI spec at
`/Users/mayakfir/Downloads/download` (the canonical Penn Courses
documentation):

| Endpoint | Auth required? | What it gives us |
|---|---|---|
| `GET /api/base/{semester}/courses/` (full list) | **No** | The complete catalog with `id`, `title`, `description`, `credits`, `attributes`, `crosslistings`, `prerequisites` text, ratings averages, etc. Pass `semester=all` for the full historical catalog. |
| `GET /api/base/{semester}/courses/{full_code}/` | **No** | Single course detail including `sections[]`, instructors, meeting times |
| `GET /api/base/{semester}/search/courses/?search=&attributes=&...` | **No** | Search with rich filtering (boolean attribute logic like `(EUHS\|EUSS)*(QP\|QS)`) |
| `GET /api/base/{semester}/attributes/` | **No** | List of all valid attribute codes with descriptions |
| `GET /api/review/autocomplete` | **No** | Cached autocomplete dump for all courses, departments, instructors |
| `GET /api/review/course/{course_code}` | **Yes (OAuth)** | Full review aggregates: `rCourseQuality`, `rDifficulty`, `rWorkRequired`, `rInstructorQuality`, `num_reviewers`, plus 15 more aggregated metrics |
| `GET /api/review/instructor/{instructor_id}` | **Yes (OAuth)** | Per-instructor history |
| `GET /api/review/department/{dept_code}` | **Yes (OAuth)** | Department-level rollups |

**The implication:** the bulk of what Penn Advisor needs (catalog, search,
crosslistings, attributes, descriptions) is available **with no SSO
token**. The token is only required for the rich review data — and even
the basic ratings (`course_quality`, `difficulty`, `work_required`,
`instructor_quality`) are exposed on the unauthenticated course listings
themselves. The token is a convenience for the *deep* review breakdowns,
not a hard requirement to integrate.

### Finding 2: Penn Labs already has Penn Degree Plan (PDP)

`https://github.com/pennlabs/penn-courses` is the unified backend for
all four products: PCR, PCP, PCA, and **PDP (Penn Degree Plan)**. PDP
has a `degree_rules` system that maps courses to specific requirement
buckets — the OpenAPI spec exposes `?degree_rules=` as a search filter
parameter. This means Penn Labs has *already* solved the
"course → bucket" problem at some level inside their backend.

**This is good news for the pitch.** Penn Advisor isn't trying to
replace PDP — it sits *on top of it*:

| Penn Degree Plan does | Penn Advisor adds |
|---|---|
| Manual degree audit (you fill it in) | **Auto-ingest from transcript PDF** (no manual entry) |
| Static "this counts" / "this doesn't" view | **LLM chat advisor** answering "what should I take next?" |
| Fixed requirement layout | **Drag courses into requirement slots** (the redesign in §3) |
| No load awareness | **Workload + difficulty preview** using PCR ratings |
| No prereq chain checking | **Prereq-aware planning** with mutex detection |
| No multi-semester forecasting | **Auto-plan generator** that finds the path to graduation |

The pitch becomes: "Penn Advisor is the planning layer Penn Labs's
existing tools don't have. We consume PCR's data, we sit alongside PDP,
we add the LLM brain on top. Adopting us means: students get this
without you building it." That's a much easier ask than "replace PDP."

### Finding 3: ID format mismatch

PCR returns IDs as `CIS-120` (dash-delimited dept and number). Our
catalog uses `CIS120` (no separator). **Every integration point needs
a normalization helper.** This is a small but ubiquitous concern — we
need a single function `normalizePcrId("CIS-120") → "CIS120"` and its
inverse `toPcrId("CIS120") → "CIS-120"` used at every API call site.
Not hard, but easy to forget at a single site and break things.

---

## Question 1 — Architecture decision

**Recommendation: Option (c) with a twist.** Cache an API snapshot at
build time as the runtime catalog source, AND add a small live PCR
client for chat-time enrichment of ratings. Keep the existing HTML
scrapers as a fallback / bootstrap mechanism only.

I evaluated all four options. Here's how each one shakes out for our
codebase specifically:

### Option (a) — Replace scraping entirely with the live API

**What changes:** every component that imports `courses.json` (18
sites, see below) becomes async — fetching catalog data over the
network on first render. `degreeEngine.js`, which is currently a pure
synchronous function, becomes async. Setup wizard's `CourseSearch`
becomes a remote search against `/api/base/current/search/courses/`.

**What breaks:**
- All 23 hardcoded `import ... from "../data/courses.json"` statements
  must be refactored to async fetches
- `degreeEngine.computeCompletion()` becomes async, which cascades into
  every consumer (StudentContext's useMemo, the dashboard, the planner)
- `transcriptParser.js`'s in-catalog check (`courses[id]`) becomes
  async per course — a transcript with 32 courses fires 32 lookups
- Loss of offline / first-paint-without-network — the dashboard can't
  render without a round trip to PCR
- The 7 sanity tests in `scripts/sanity.mjs` need a fixture or a real
  API call, both of which are slower than the current synchronous run

**What gets better:**
- Always-fresh catalog (Penn updates → we see it next page load)
- We get PCR's structured `attributes`, `prerequisites` (text),
  `crosslistings`, and `sections` schemas without re-modeling them

**Verdict: too disruptive for the demo phase.** This is the right
end state but the wrong starting point.

### Option (b) — Keep scraping as primary, use API only for enrichment

**What changes:** add a small `pcrClient.js` that the chat advisor's
`lookup_course` tool calls for ratings/difficulty. Nothing else moves.

**What breaks:** essentially nothing.

**What gets better:** the chat advisor can answer "is CIS 4190 hard?"
with real PCR data instead of guessing.

**Verdict:** safe but doesn't address the underlying brittleness of
the scrapers (244 dept HTML pages, sometimes flake, manual to
re-run).

### Option (c) — Cache an API snapshot at build time *(RECOMMENDED + extended)*

**What changes:**
- A new ingest script `scripts/ingest/fetchPcrCatalog.mjs` hits
  `GET /api/base/all/courses/` (unauthenticated) and writes a
  normalized snapshot to `src/data/pcrSnapshot.json` with the **same
  schema** as our existing `courses.json`. ID normalization
  (`CIS-120` → `CIS120`) happens here.
- A new `scripts/ingest/mergeCatalogs.mjs` (or just integrated into
  the fetch script) merges the PCR snapshot with our existing
  attribute / writing-seminar / tech-elective overlays from the
  current ingest scripts. The output replaces `courses.json`.
- `pcrClient.js` (browser + serverless) provides on-demand calls to
  `/api/review/course/{code}` for the chat advisor's enrichment tool.
- The existing HTML scrapers (`scrapeAllCourses.mjs`,
  `scrapeCatalog.mjs`) become **fallback bootstrap tools**. We keep
  them in `scripts/ingest/` but document that PCR is now the primary.

**What breaks:** essentially nothing at runtime. The runtime app
still imports `courses.json` synchronously — only the *ingest pipeline*
behind it changes. All 23 import sites stay exactly as they are.

**What gets better:**
- We get every course Penn currently offers without scraping HTML
- We get PCR's `attributes` directly (no separate fetch per attribute)
- We get crosslistings, instructor data, section schedules for free
- We get ratings on the basic course objects — no auth required for
  `course_quality`, `difficulty`, `work_required`, `instructor_quality`
- The 244-dept HTML scrape is dethroned but still available as a
  safety net
- The chat advisor can pull deep review data on demand via the live
  `pcrClient` — now grounded in real student feedback

**Verdict: best fit for the demo phase.** Minimal disruption,
maximum data quality lift.

### Option (d) — Custom hybrid

This *is* the recommendation. (c) was originally just "cache a
snapshot"; I'm extending it with a live enrichment client for chat.

### Final recommendation in one sentence

**Adopt Option (c) extended:** rebuild `courses.json` from a PCR
snapshot at build time, keep the runtime sync-import architecture
intact, add a `pcrClient.js` that the chat advisor uses on demand for
review enrichment, and keep the HTML scrapers in the repo as
fallbacks.

---

## Question 2 — Data gaps the API can't fill

The PCR API gives us ~95% of what we need. The remaining 5% is the
part Penn Advisor's value depends on, and it has to stay
hand-curated.

### What stays in `programs.json` (irreplaceable, hand-curated)

This is the file that maps **a specific Penn major's requirement
structure to the catalog.** PCR has an attributes system and a
`degree_rules` filter, but the Penn Labs OpenAPI spec does NOT expose
a documented endpoint that returns "the complete requirement tree for
the SEAS BSE Artificial Intelligence major." That data lives in:

1. **Penn's published catalog HTML** (e.g., the AI BSE catalog page
   we scraped during Phase 1)
2. **SEAS handbook PDFs** (per-major requirement breakdowns)
3. **Penn Labs's PDP backend** (closed; we don't have read access yet)

So `programs.json` is the artifact that captures, **for one specific
major**, the per-leaf course pools (`from.course_ids`,
`from.attribute`, `from.attributes`), the section-title constraints
(`section_title_required`), the writing-seminar tag constraint, the
1000-level cap, and the AI section's "no double-counting" rule. This
is **curriculum design content**, not catalog data, and must be
maintained by hand or eventually fed by Penn Labs's degree_rules
system if we get backend access.

The architecture must make this clear: **`courses.json` is "what Penn
says exists"; `programs.json` is "what THIS major requires of those
courses."** Two orthogonal sources, two different update cadences, two
different owners.

### What also stays hand-curated

| Gap | Why it stays out of PCR | Who provides it |
|---|---|---|
| **AP / transfer credit equivalencies** | Penn registrar's internal mapping; not in public API | Student input via setup wizard (future) or hand-coded table |
| **The "AI Ethics Elective only counts if section title is 'Technology Law and Ethics'" constraint on LAWM 5060** | This is a curriculum-specific business rule, not a catalog fact | `programs.json` `constraints[]` |
| **Cross-listed undergrad/grad pairs as MUTEX** | PCR exposes `crosslistings` (the same course at multiple codes) but doesn't tag them as mutually exclusive for *audit purposes* — the "you can only count one" rule is curriculum-imposed | We compute mutex from PCR's `crosslistings` field at ingest time |
| **Free-text restrictions** ("permission required", "graduate students only") | PCR has a `restrictions[]` field but it's loosely-typed text | Stays as raw text on the course; we don't try to parse it |
| **Degree minor requirement trees** | Same as program requirements but for minors | `minors.json` (currently a `{}` stub; future hand-modeling task) |

### What PCR DOES give us that we're not currently using

These are the wins from the migration:

| Field | Current source | PCR source | Why it matters |
|---|---|---|---|
| Course title, credits | catalog HTML scrape | `id`, `title`, `credits` | Same data, fresher |
| Description | catalog HTML scrape | `description` | We don't have this today; useful for chat context |
| Crosslistings | manually inferred from mutex | `crosslistings: ["LING-4300"]` | Authoritative; replaces our hand-detection |
| Attributes | scraped from `catalog.upenn.edu/attributes/<code>/` pages | `attributes: [{code, school, description}]` | One API call instead of 5 separate scrapes |
| Difficulty / workload (basic) | none | `course_quality`, `difficulty`, `work_required`, `instructor_quality` (0-4 scale) | New capability for the planner |
| Instructor names | none | `sections[*].instructors` | New for chat ("who teaches CIS 4190?") |
| Search | client-side filter on the local 15K catalog | `GET /api/base/current/search/courses/?search=&attributes=` | We can do server-side attribute-filtered search |
| Pre-NGSS requirements | none | `pre_ngss_requirements: [{code, school, name}]` | Useful for older students whose plan was set under the old system |

---

## Question 3 — The slot-based semester planner

This is a fundamentally different model from what's in the codebase
today. The current Semesters tab shows **courses placed in terms**.
The user wants **slots placed in terms**, where each slot is a
placeholder for one CU of a specific requirement, and a course gets
assigned *to* a slot.

### Vocabulary

| Term | Definition |
|---|---|
| **Slot** | A placeholder for 1 CU of a specific requirement leaf. E.g., the AI Electives leaf with `min_cu: 6` produces 6 slots: `(ai.electives, instance 1)` through `(ai.electives, instance 6)`. The Computing section's `computing.cis1100` leaf produces 1 slot: `(computing.cis1100, instance 1)`. Total slot count = sum of `min_cu` across all leaves = the program's total CU. |
| **Slot id** | Stable string: `"<leafId>:<instance>"`, e.g., `"ai.electives:3"` or `"computing.cis1100:1"`. |
| **Slot state** | One of: `unscheduled` (not in any term), `scheduled-empty` (in a term, no course assigned), `scheduled-filled` (in a term, has a course), `auto-filled` (engine assigned a transcript course to it without the student touching it) |
| **Slot ⟶ course assignment** | A course id pinned to a specific slot id. Mirrors the existing `pinnedSlot` field but at slot-instance granularity, not leaf granularity. |
| **Eligible course pool** | The set of course IDs that can fill a given slot. Computed from the leaf's `from` field via the existing `courseIdsMatchingLeafPool` helper. |

### Data model — what gets stored

A new shape on `StudentContext` (persisted to localStorage):

```typescript
type SlotAssignment = {
  slotId: string;          // e.g. "ai.electives:1"
  leafId: string;          // e.g. "ai.electives"
  instance: number;        // 1-indexed within the leaf
  term: string | null;     // "Fall 2026" or null if unscheduled
  courseId: string | null; // assigned course id, or null if empty
};

type StudentState = {
  // ... existing fields ...
  slotAssignments: Record<string, SlotAssignment>; // keyed by slotId
};
```

The slot list is **derived** from `programs.json[programId].requirement`
on every render — there's no need to persist the slot definitions
themselves, only the user's assignments. A pure utility
`buildSlotList(programId): SlotAssignment[]` walks the requirement
tree and produces the canonical list with default state.

### How slots map to the existing engine

The engine's job today is "given completed courses + program tree,
auto-assign each course to a leaf and produce a CompletionStatus
tree." That logic stays. The slot model is a **UI projection** of the
engine's output:

1. **For COMPLETED courses** (from the transcript): the engine
   already determines which leaf each course satisfies. We map each
   leaf assignment to the next available slot of that leaf and mark
   it `auto-filled` (or `scheduled-filled` if the user has manually
   pinned a course).
2. **For PLANNED slots** (the student is sketching their future):
   slots are explicit user objects in `slotAssignments`. The student
   drags them into terms and assigns courses to them.

This means **the engine doesn't need to know about slots.** Slots
are purely a planner-side concept that wraps the engine output. The
existing `pinnedSlot` field becomes `pinnedSlotInstance` (carrying
the instance number), and the engine's slot-pinning logic in
`degreeEngine.js:184-210` extends to honor instance-level pins.

### UI shape

**Three regions on the redesigned Semesters tab:**

1. **Top: Open Slot Tray** — a horizontal scroll of all unscheduled
   slots, grouped by section, with each slot rendered as a small
   draggable chip:
   ```
   ┌─ Open slots (12 left) ──────────────────────────────────────┐
   │  AI Electives ──────────────────────────────────────────    │
   │  [AI Elec 1] [AI Elec 2] [AI Elec 3] [AI Elec 4] [...]      │
   │                                                              │
   │  General Electives ────────────────────────────────────     │
   │  [Cog Sci] [SS/H 1] [SS/H 2] [SS/H 3] [Free Elective]       │
   └──────────────────────────────────────────────────────────────┘
   ```
   Click or drag a chip to put it into a term card below. Click an
   already-scheduled slot's chip in a term card to send it back here.

2. **Middle: Timeline of Term Cards** — same chronological layout
   as the current redesign (completed → in-progress → planned). The
   difference: planned term cards now hold **slot chips**, not course
   chips. Each slot in a term shows:
   - Slot label (e.g. "AI Elec 3")
   - The eligible-course count: "≈12 courses match"
   - If filled: the assigned course code (e.g. "CIS 4500") + a small
     PCR difficulty badge ("Difficulty 2.8")
   - Click → opens a course picker scoped to that slot's eligible
     course pool
   - Drag handle to move the slot to a different term

3. **Bottom: Workload Summary** — for each term card, the total CU
   planned plus an aggregated PCR difficulty/workload score so the
   student can see "Spring 2027 looks like 4 hard courses; consider
   rebalancing."

### The "this course can fill multiple slots" prompt

When the student picks a course for slot X, but that course also
happens to be eligible for slot Y in another section, we surface a
small disambiguation modal:

> *CIS 4300 can count as either:*
> - *AI / Vision & Language*
> - *AI / AI Project*
> *Which would you like?*

This is the existing `getEligibleRequirementLeaves(course, programId)`
helper, surfaced at the moment of assignment instead of after the
fact. The user picks one; the slot assignment is recorded; the engine
re-runs.

### Auto-plan in slot terms

The current `planGenerator.js` outputs `Record<string, string[]>`
(term → course IDs). The new model needs it to output `Record<string,
SlotAssignment>` (slot id → assignment). The auto-plan logic stays:
walk gaps, pick courses, topo-sort by prereq depth, distribute
across terms. The output shape is what changes — and the existing
plan generator already operates on the same `getIncompleteGaps` data,
so the rewrite is a renaming + shape change, not a rethink.

### Files for the slot-based planner (new)

| File | Role | Lines (est) |
|---|---|---|
| `src/utils/slotBuilder.js` | Pure: builds the canonical slot list from a program's requirement tree | ~60 |
| `src/utils/slotEligibility.js` | Pure: per-slot computation of eligible course IDs (wraps existing helpers) | ~40 |
| `src/state/slotAssignments.js` | Helpers + persistence shape; new field on StudentContext | ~80 |
| `src/components/Dashboard/OpenSlotTray.jsx` | The top-of-page draggable slot tray | ~150 |
| `src/components/Dashboard/SlotChip.jsx` | One slot chip (used in tray + term cards) | ~80 |
| `src/components/Dashboard/SlotPicker.jsx` | Modal for picking a course to fill a slot, scoped by eligible pool, with PCR ratings shown | ~180 |
| `src/components/Dashboard/SlotConflictModal.jsx` | "This course can fill multiple slots — pick one" disambiguation | ~100 |
| `src/utils/slotWorkload.js` | Pure: computes a per-term workload/difficulty rollup using PCR ratings | ~50 |

### Files for the slot-based planner (modified)

| File | Change |
|---|---|
| `src/utils/planGenerator.js` | Output shape changes from `planByTerm` (course IDs) to `slotAssignments` (slot ID → {term, courseId}) |
| `src/components/Dashboard/TimelineTermCard.jsx` | Planned-term branch renders `SlotChip` instances instead of `PlannedCourseRow`. Completed/in-progress branches unchanged. |
| `src/components/Dashboard/SemestersPanel.jsx` | Top of page now renders `OpenSlotTray`. The existing OpenRequirementsPanel is repurposed or absorbed. |
| `src/state/StudentContext.jsx` | Adds `slotAssignments` field, getters/setters, persistence |
| `src/utils/degreeEngine.js` | Extends `pinnedSlot` to support `(leafId, instance)` granularity (or keeps it leaf-level and treats slot instances as a pure UI concern — see open question below) |

### Files I'd consider deprecating

| File | Why |
|---|---|
| `src/components/Dashboard/AddPlannedCourseInline.jsx` | Replaced by the slot-picker flow (you pick a slot, then a course for that slot — not "add any course to a term") |
| `src/components/Dashboard/CourseAssignmentPopover.jsx` | Still useful for completed courses (re-pinning), but the planned-side UX moves to slot picker |

### One important open question

Should slot instances be **first-class engine concepts** (the engine
distinguishes `ai.electives:1` from `ai.electives:3`, allows pinning a
course to instance 3 specifically) or **purely a UI projection** (the
engine still operates at leaf granularity; the UI assigns a
display-only instance number when listing courses in a leaf)?

- **First-class** is more flexible (the student can decide which
  specific instance gets which course, useful if instances are
  visually arranged in different terms with different prereq contexts)
- **Pure UI projection** is simpler (no engine changes; the UI just
  numbers courses 1..N within each leaf for display)

I lean toward **pure UI projection** because the engine doesn't
actually care which "instance" of a leaf a course fills — just that it
fills the leaf. The student's mental model of "slots in terms" can be
satisfied by storing `slotAssignments[slotId] = {term, courseId}` and
having the engine read just the `(leafId, courseId)` pair (ignoring
the instance index). This way the engine stays unchanged and the slot
model is purely UI state. **I'll ask the user about this in the
clarifying questions below.**

---

## Question 4 — Step-by-step migration plan (minimum disruption)

The user asked for **the minimum set of changes to make the API
integration work alongside what we have, without breaking anything.**
Here's that plan, ordered so each step is independently shippable
and revertable.

### Phase 1 — Add the PCR client (no migrations yet)

Goal: get a working PCR client without touching any existing code path.

1. **Create `src/utils/pcrClient.js`** — pure module with:
   - `fetchCourse(fullCode)` → calls `/api/base/current/courses/{fullCode}/`
   - `searchCourses({query, attributes, semester})` → calls `/api/base/current/search/courses/`
   - `fetchReviews(fullCode, token)` → calls `/api/review/course/{fullCode}` (auth-required, returns null if no token)
   - `fetchCatalogDump()` → calls `/api/base/all/courses/` (the full catalog snapshot)
   - All functions accept an optional `fetch` instance for testability
   - Returns errors as `{ ok: false, error }`, never throws
   - In-memory cache keyed by URL with a 1-hour TTL

2. **Create `src/utils/normalizePcrId.js`** — two pure functions:
   - `pcrIdToInternal("CIS-120") → "CIS120"`
   - `internalIdToPcr("CIS120") → "CIS-120"`
   - Handles edge cases: leading zeros (`CIS 100` vs `CIS 0100`), letter
     suffixes (`CIS 120A`), department prefixes longer than 4 chars
     (`AAMW`, `LAWM`)
   - 100% unit-testable

3. **Create `.env.example`** entry — `VITE_PCR_TOKEN=` (optional; only
   needed for review enrichment)

4. **Smoke test** in node: hit
   `https://penncoursereview.com/api/base/current/courses/CIS-4190/`
   without any token, verify it returns 200 with the expected fields.

**What doesn't change:** nothing. No imports added to the runtime
bundle. This is purely additive scaffolding.

### Phase 2 — Build the snapshot ingest

Goal: rebuild `courses.json` from PCR data, validating that the schema
match is good.

5. **Create `scripts/ingest/fetchPcrCatalog.mjs`** — node script that:
   - Calls `pcrClient.fetchCatalogDump()` (full catalog with `semester=all`)
   - Maps each PCR course → our internal schema using the normalizer
   - For each course, populates: `id` (normalized), `title`, `cu`
     (from PCR `credits`), `level` (parsed from id), `attributes`
     (mapped from PCR's `attributes[].code`), `prerequisites` (parsed
     from PCR's text `prerequisites` field — best effort),
     `mutuallyExclusive` (derived from `crosslistings[]`),
     `tech_elective_status` (initially null), `tags` (initially empty)
   - Writes to `src/data/raw/pcr_snapshot.json` (raw PCR data, never
     bundled into the app)
   - Writes to `src/data/courses.json` (our normalized format,
     bundled into the app)
   - Idempotent + cached HTML responses in `src/data/raw/pcr_cache/`

6. **Update existing overlay scripts** to operate on top of the
   PCR-derived `courses.json` instead of the HTML-derived one. The
   3 existing overlay scripts (`fetchAttribute.mjs`,
   `fetchWritingSeminars.mjs`, `normalizeTechElectives.mjs`) already
   operate as merge-into-courses.json — they just need to run AFTER
   `fetchPcrCatalog.mjs` instead of after the HTML scrapers. The
   ordering becomes:
   1. `fetchPcrCatalog.mjs` (PCR → courses.json base)
   2. `fetchAttribute.mjs euns` etc. (catalog HTML → attribute overlay)
   3. `fetchWritingSeminars.mjs` (handbook → tag overlay)
   4. `normalizeTechElectives.mjs` (CIS advising JSON → tech_elective_status)
   The HTML scrapers (`scrapeAllCourses.mjs`, `scrapeCatalog.mjs`)
   become deprecated but kept around as fallbacks.

7. **Create `scripts/ingest/validatePcrSnapshot.mjs`** — diff tool that
   reports:
   - Courses in PCR not in our current `courses.json` (additions)
   - Courses in our `courses.json` not in PCR (likely retired/renamed)
   - Schema mismatches (different `cu`, different `title`)
   - Attribute mismatches (PCR says EUSS, ours says nothing)
   - Print as a markdown report so the user can eyeball it before
     running the swap

8. **Run the validator** before flipping the switch. Resolve any
   surprising deltas manually.

### Phase 3 — Wire ratings into the chat advisor + the "what am I close to" query

Goal: prove the live PCR client works in production AND give the
chat advisor the ability to surface hidden opportunities — the demo
moment for Penn Labs.

This phase has TWO deliverables:

#### 3A — `lookup_course_reviews` tool (the basic enrichment)

9. **Extend `api/chat.js`'s `lookup_course` tool** with a new sibling
   tool: `lookup_course_reviews(course_id)`. Server-side, calls
   `pcrClient.fetchReviews()` with the server's `PCR_TOKEN` env var.
   Returns the standard rating fields:
   `{rCourseQuality, rDifficulty, rWorkRequired, rInstructorQuality, num_reviewers}`.
   Falls back gracefully if no token: returns
   `{available: false, message: "Review data requires Penn Labs auth"}`.

10. **Update the system prompt** in `src/llm/systemPrompt.js` to
    advertise the new tool. The chat can now answer "is CIS 4190
    hard?" with real PCR data.

11. **Add `PCR_TOKEN`** to the local dev `.env.local` (not committed)
    and to Vercel's environment variables (eventually).

#### 3B — The "near-miss minors" / hidden-opportunities capability

This is the **demo moment for Penn Labs.** Most students don't know
they're 1 course away from a minor, or that taking one specific
elective would unlock a more efficient path to a concentration. The
chat advisor needs to surface this proactively.

12. **Build `src/utils/nearMissAnalyzer.js`** — a pure analysis
    function `findHiddenOpportunities({completedCourses, programId})`
    that walks the student's completion state and returns a structured
    list of opportunities:
    ```js
    {
      nearMissMinors: [
        {
          minorId: "math",
          minorName: "Mathematics Minor",
          coursesAlreadyCounting: ["MATH1400","MATH1410","CIS1600","ESE2030"],
          coursesShortBy: 1,
          suggestedCourses: ["MATH2400","MATH2410"],  // would complete it
          confidence: "high"  // 80%+ already counts
        }
      ],
      attributeOptimizations: [
        {
          type: "swap_pinning",
          description: "CIS 4300 currently fills Vision & Language; pinning it to AI Project would free Vision & Language for CIS 5300, completing both slots.",
          impact: "Saves 1 elective"
        }
      ],
      uncountedAttributes: [
        {
          courseId: "PHIL1710",
          unusedAttribute: "EUHS",
          slotItCouldFill: "gen.ssh3"
        }
      ]
    }
    ```

13. **Build `src/data/minors.json`** with the SEAS minor requirement
    trees (Math, CS, Stats, Cognitive Science, Engineering Entre,
    etc.). Same `Requirement` schema as `programs.json`. The current
    `minors.json` is `{}` — we expand it to ~5 minors so the analyzer
    has something to walk.

14. **Add a third chat tool**: `find_hidden_opportunities()`. No
    arguments — pulls the student state from the advisor context
    that's already injected on every chat turn. Returns the analyzer's
    structured output.

15. **Update the system prompt** to mention this tool prominently.
    The advisor should call `find_hidden_opportunities()` proactively
    at the start of any "what should I take?" / "am I missing
    anything?" / "what's a good plan?" / "help me optimize my
    schedule" conversation, even if the user didn't explicitly ask.

16. **Update `src/llm/buildAdvisorContext.js`** to include a brief
    "potential opportunities count" in the always-injected context
    block, so the LLM knows it's worth calling the tool. Example:
    `<opportunities count="3" hint="2 near-miss minors, 1 attribute optimization" />`

17. **Add `nearMissAnalyzer.js` smoke test** to `scripts/sanity.mjs`
    or a new `scripts/sanityNearMiss.mjs`. Verify that with a junior
    AI BSE student who took MATH 1400/1410, ESE 2030, CIS 1600, the
    analyzer returns `nearMissMinors[0].minorId === "math"` with
    `coursesShortBy === 1` (Math minor is 6 CU; she has 4-5 of them
    via her required courses).

The combination of tools 3A + 3B is what makes Penn Advisor's chat
advisor *materially better* than every other Penn tool. PDP doesn't
do this. PCR doesn't do this. PCP doesn't do this. This is the part
of the demo that makes Penn Labs say "oh — that's interesting."

### Phase 4 — The slot-based planner redesign (DEFERRED — see status block at top)

> Phases 4 and 5 are explicitly deferred. The plan content below is
> preserved for reference when we eventually return to it. **Do not
> start any of step 18 onward until Phases 1–3 ship and the user has
> tested the chat enrichment + near-miss minors flow.**

Goal: rebuild the Semesters tab planning UX in slot terms.

18. **Build `src/utils/slotBuilder.js`** — pure function that takes a
    program ID and returns the canonical slot list:
    ```js
    buildSlotList("SEAS_AI_BSE") → [
      { slotId: "computing.cis1100:1", leafId: "computing.cis1100", instance: 1, label: "CIS 1100", sectionLabel: "Computing", requiredCu: 1 },
      { slotId: "ai.electives:1", leafId: "ai.electives", instance: 1, label: "AI Elec 1", sectionLabel: "AI Electives", requiredCu: 1 },
      // ... 37 slots total for SEAS_AI_BSE
    ]
    ```

19. **Add `slotAssignments`** to `StudentContext` and `storage.js`.
    Default: every slot has `term: null, courseId: null`. Hydrate from
    transcript on first load by mapping the engine's auto-assignments
    to slot instances (the first transcript course in `ai.electives`
    fills `ai.electives:1`, the second fills `ai.electives:2`, etc.).

20. **Build `OpenSlotTray.jsx`** — top-of-page horizontal tray of
    unscheduled slots, grouped by section. Each chip is a draggable
    `SlotChip`.

21. **Build `SlotChip.jsx`** — one component, two visual modes:
    - "Open" (in tray): shows label + section + eligible-course count
    - "Filled" (in a term card): shows label + assigned course code
      + PCR difficulty badge

22. **Build `SlotPicker.jsx`** — modal that opens when the student
    clicks an empty slot. Lists eligible courses (from `slotEligibility`)
    sorted by PCR `course_quality` desc, with difficulty/workload
    badges. Click a course to assign it.

23. **Build `SlotConflictModal.jsx`** — opens when the student picks a
    course that's eligible for >1 slot. "CIS 4300 can count as:
    AI/Vision&Language OR AI/Project. Which?"

24. **Refactor `TimelineTermCard.jsx`** — planned-term branch renders
    a list of `SlotChip` (filled or empty). Completed and in-progress
    branches unchanged.

25. **Refactor `planGenerator.js`** — outputs `slotAssignments` shape
    instead of `planByTerm`. Same algorithm; just write to the new
    shape.

26. **Drag and drop wiring** — install `@dnd-kit/core` (locked
    decision). Make `SlotChip` draggable and term cards droppable.
    (~100 lines of glue.)

27. **Workload rollup** — `slotWorkload.js` reads PCR ratings via
    `pcrClient` (cached) and computes a per-term aggregate. Display in
    each term card header.

### Phase 5 — Validation and migration (DEFERRED)

Goal: cut over safely.

28. **Run `validatePcrSnapshot.mjs`** end to end. Verify the new
    `courses.json` is at least as complete as the old one for the
    AI BSE program's required courses.

29. **Run `node scripts/sanity.mjs`** — all 7 engine cases must still
    pass. The sanity tests use known course IDs; if those IDs are
    still in the new `courses.json` (they should be), the engine
    behaves identically.

30. **Manual QA**: full happy path with a real Maya transcript.
    Upload → dashboard → semesters tab → slot tray → drag a slot →
    pick a course → see updated workload → ask the chat "is CIS 4190
    hard?" and verify it returns PCR data.

31. **Commit phase by phase**, not all at once. Each phase is an
    independent commit with a clear name.

### Estimated effort

| Phase | Effort | Risk | Status |
|---|---|---|---|
| 1 — PCR client | ~2 hours | Very low | **In progress (this turn)** |
| 2 — Snapshot ingest + validator | ~4 hours | Low | Pending |
| 3A — Chat ratings enrichment | ~1 hour | Very low | Pending |
| 3B — Near-miss minors / hidden opportunities | ~3 hours | Medium (new analyzer + minors.json) | Pending |
| 4 — Slot-based planner | ~12 hours | High (UX rework) | **DEFERRED** |
| 5 — Validation + migration | ~2 hours | Low | **DEFERRED** |
| **Total committed for now (1–3)** | **~10 hours** | Mixed | |

Phases 1–3 (~10 hours including the new 3B near-miss work) are the
core API integration + LLM advisor upgrade the user has approved.
Phase 4 (~12 hours) and Phase 5 (~2 hours) are deferred.

---

## Files to create / modify / delete

### To create

| File | Purpose |
|---|---|
| `src/utils/pcrClient.js` | Pure browser + serverless module for PCR API calls |
| `src/utils/normalizePcrId.js` | Two-way ID format converter |
| `scripts/ingest/fetchPcrCatalog.mjs` | New ingest script: PCR API → `courses.json` |
| `scripts/ingest/validatePcrSnapshot.mjs` | Pre-migration diff tool |
| `src/utils/slotBuilder.js` | Pure: requirement tree → slot list |
| `src/utils/slotEligibility.js` | Pure: per-slot eligible course IDs |
| `src/utils/slotWorkload.js` | Pure: term workload rollup using PCR ratings |
| `src/components/Dashboard/OpenSlotTray.jsx` | Top-of-page slot tray |
| `src/components/Dashboard/SlotChip.jsx` | Draggable slot chip (tray + term card) |
| `src/components/Dashboard/SlotPicker.jsx` | Modal: pick a course to fill a slot |
| `src/components/Dashboard/SlotConflictModal.jsx` | "This course fills multiple slots" disambiguation |

### To modify

| File | Change |
|---|---|
| `src/data/courses.json` | Regenerated from PCR (Phase 2) |
| `src/state/StudentContext.jsx` | Add `slotAssignments` field + persistence |
| `src/utils/storage.js` | Persist `slotAssignments` |
| `src/utils/planGenerator.js` | Output `slotAssignments` shape instead of `planByTerm` |
| `src/components/Dashboard/SemestersPanel.jsx` | Replace OpenRequirementsPanel + timeline cards with slot-tray + slot-bearing timeline |
| `src/components/Dashboard/TimelineTermCard.jsx` | Planned-term branch renders slots, not courses |
| `api/chat.js` | Add `lookup_course_reviews` tool |
| `src/llm/systemPrompt.js` | Advertise the new tool |
| `.env.example` | Add `VITE_PCR_TOKEN` (optional) and `PCR_TOKEN` (server) |

### To deprecate (not delete yet)

| File | Why kept |
|---|---|
| `scripts/ingest/scrapeAllCourses.mjs` | Fallback bootstrap if PCR is down or rate-limited |
| `scripts/ingest/scrapeCatalog.mjs` | Same — may still be useful for historical data PCR doesn't have |
| `src/components/Dashboard/AddPlannedCourseInline.jsx` | Used today; replaced by SlotPicker once slot redesign lands |

---

## Reusable utilities (already in place — DO NOT REWRITE)

- `getEligibleRequirementLeaves(course, programId)` — `src/utils/eligibleRequirementLeaves.js:77` — used by `SlotPicker` to know which slots a course CAN fill (for the disambiguation modal)
- `courseIdsMatchingLeafPool(rawLeaf, catalogList)` — `src/utils/programRequirementIndex.js:88` — used by `slotEligibility.js`
- `getProgramRequirement(programId)` — `src/utils/programRequirementIndex.js:116` — used by `slotBuilder.js`
- `getIncompleteGaps(completion, programReq)` — `src/utils/programRequirementIndex.js:70` — still used by the (now-renamed) plan generator
- `compareSemesterLabels` / `semesterSortKey` — `src/utils/semesterOrder.js`
- `getPrereqStatus(courseId, ctx)` — `src/utils/prereqStatus.js` — slot-side prereq check
- `generatePlan({completion, completedCourses, programId, targetTerm})` — `src/utils/planGenerator.js` — algorithm stays, output shape changes
- `computeCompletion(courses, programId)` — `src/utils/degreeEngine.js` — unchanged
- `solve({courses, slots})` — `src/utils/assignmentSolver.js` — unchanged
- `parseTranscriptPdf(file)` — `src/utils/transcriptParser.js` — unchanged
- `lookup_course` tool — `api/chat.js` — extended with sibling tool, not replaced

---

## Verification

After Phase 5:

```bash
cd "/Users/mayakfir/Documents/05 Recruitment/penn-advisor"

# Engine sanity tests still pass
node scripts/sanity.mjs | grep "Total CU"
# expect: 7 lines, case E shows "Total CU: 37 / 37"

# PCR snapshot validator
node scripts/ingest/validatePcrSnapshot.mjs
# expect: report of any deltas; manually inspect

# Build is clean
npx vite build && rm -rf dist

# Dev server boots
npm run dev
```

**Manual end-to-end with Maya's transcript:**

1. `/setup?reset=1`, upload transcript → dashboard
2. **Semesters tab**: see the open slot tray at the top with 12-ish
   unscheduled slots grouped by section
3. Drag "AI Elec 1" into the Fall 2026 card → slot moves
4. Click "AI Elec 1" in Fall 2026 → SlotPicker opens with eligible
   courses sorted by PCR course_quality
5. Pick `CIS 4500` → course is assigned, slot shows the code + a
   PCR difficulty badge "Difficulty 2.4"
6. The Fall 2026 term header now shows "1 CU planned · est. workload 3"
7. **Chat sidebar**: ask "Is CIS 4500 hard?" → response includes real
   PCR review data (difficulty, workload, instructor quality)
8. **Overview tab**: unchanged
9. Reload → state persists

---

## Out of scope for this plan

These are explicitly NOT covered:

- **Penn Labs SSO integration end-to-end.** We're using a copy-paste
  Bearer token from DevTools for now (Phase 3). Real OAuth handshake
  via Penn Labs Accounts Engine is a separate phase, only needed when
  we ship to real students.
- **Multi-program support** (CS BSE, NETS, DMD). Still one program at
  a time until we have a way to ingest more requirement trees.
- **Penn Labs adoption pitch deck**. The plan assumes the demo is the
  pitch artifact; the actual conversation with Penn Labs is a separate
  workstream.
- **Replacing `degreeEngine.js`'s pure-sync model with async fetching.**
  We keep the build-time snapshot model. If Penn Labs eventually gives
  us a streaming API, that's a future migration.
- **Mobile responsive UI for the slot tray.** Desktop only for the demo.

---

## Open questions — ALL ANSWERED (2026-04-09)

The three forks I flagged before any code was written. All resolved
in the conversation; recording answers here so future-me has the
canonical record.

1. **Slot instances: first-class engine concept or pure UI projection?**
   → **Pure UI projection.** The engine continues operating at leaf
   granularity; the UI numbers courses 1..N within each leaf for
   display. No engine changes needed when Phase 4 starts. (Locked)

2. **Drag-and-drop library: `@dnd-kit/core` or hand-rolled HTML5 DnD?**
   → **`@dnd-kit/core`.** Accessible, mobile-friendly, ~30 KB. Will
   be installed at the start of Phase 4. (Locked)

3. **Phase split: Phases 1–3 first, then pause, or all five in one go?**
   → **Phases 1–3 only for now.** Phase 4 and Phase 5 are deferred
   until after Phase 3 ships and the user has tested the chat
   enrichment + near-miss minors flow. (Locked)

### New addition (locked 2026-04-09): Phase 3B — near-miss minors

The user added a new requirement to Phase 3 after the initial plan was
written: the chat advisor must be able to answer *"what am I close to
that I don't know about?"* as a first-class query. This is the demo
moment for Penn Labs and is materially different from Penn Degree
Plan, Penn Course Plan, and Penn Course Review combined. See Phase 3B
above (steps 12–17) for the implementation plan.
