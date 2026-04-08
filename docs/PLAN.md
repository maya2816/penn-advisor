# Penn Advisor — Phase Plan

Living document. Updated as phases complete or scope changes.

## Background

Penn Advisor is an LLM-powered degree-planning tool for Penn undergraduates. Stack: Vite + React, Anthropic Claude API via Vercel serverless functions, localStorage for MVP, Vercel deploy.

The data layer is built around three concerns:
1. **A unified `Requirement` tree** in `programs.json` (each node says "give me N CUs from this pool").
2. **A flat `courses.json` catalog** holding every course's id, title, CU, level, attributes, prerequisites, and mutual-exclusion data.
3. **A pure `degreeEngine.js`** that walks the tree and uses an `assignmentSolver.js` to handle "one course can only satisfy one slot" conflicts.

The complete decision history for the original schema is in `/Users/mayakfir/.claude/plans/rippling-noodling-dongarra.md`.

---

## Phase 4 (Session A) — UI scaffold  ✅ DONE 2026-04-07

Built the read-only dashboard half of Phase 4. Session B (chat advisor + Vercel API) is the remaining work.

**Tooling installed**: Tailwind v3 + PostCSS + Autoprefixer, react-router-dom, @anthropic-ai/sdk (for Session B), uipro-cli + UI/UX Pro Max skill at `.claude/skills/ui-ux-pro-max/`. `tailwind.config.js` defines the Penn-blue color scale, soft success/warning/danger tones, Inter sans + JetBrains Mono numerics, and a card shadow scale. `src/index.css` is now Tailwind-driven.

**Pre-Phase-4 cleanup**: fixed the over-eager conflict warning in `assignmentSolver.js` (one-line filter — don't list candidates already consumed by sibling slots). All 7 sanity cases still pass.

**Files created** (~17 source files):
- `src/components/Layout/AppShell.jsx` — top bar + 1400px content container, conditional Reset link on /dashboard
- `src/components/Layout/RequireSetup.jsx` — route guard
- `src/state/StudentContext.jsx` — single source of truth, hydrates from localStorage, caches `computeCompletion()` result via useMemo
- `src/utils/storage.js` — typed localStorage wrapper (5 functions)
- `src/utils/parser.js` — transcript regex parser, validates against `courses.json`, returns `{found, unknown}`
- `src/pages/SetupPage.jsx` — 3-step wizard container with horizontal step indicator
- `src/components/Setup/StepProgram.jsx` — program picker (iterates `programs.json` so multi-program later is zero-touch)
- `src/components/Setup/StepCourses.jsx` — tabbed paste-or-search input + running list
- `src/components/Setup/StepConfirm.jsx` — review screen with stat cards + by-department course list
- `src/components/Setup/CourseSearch.jsx` — debounced autocomplete against `courses.json`
- `src/pages/DashboardPage.jsx` — composes Hero + section grid + drawer + chat sidebar slot, with warning-bucketing useMemo
- `src/components/Dashboard/Hero.jsx` — circular CU ring + 2×2 stat row
- `src/components/Dashboard/ProgressRing.jsx` — pure SVG, no chart library
- `src/components/Dashboard/SectionCard.jsx` — single card with progress bar, status pill, inline warning chip
- `src/components/Dashboard/SectionDetail.jsx` — slide-out drawer showing leaves + their courses
- `src/App.jsx` — replaced Vite default with `<BrowserRouter>` + 4 routes + StudentProvider wrap
- Removed `src/App.css` (Vite default; conflicted with Tailwind)

**Verification done**:
- `npx vite build` — clean build, ~1.37 MB bundle (mostly courses.json inlined; lazy-load later if needed)
- `npm run dev` — boots in 178 ms; index HTML + every key module returns HTTP 200
- `node scripts/sanity.mjs` — all 7 cases still pass after the engine cleanup

**Known cosmetic issues to fix in polish pass**:
- The bundle is 1.37 MB because `courses.json` gets inlined. Acceptable for MVP; revisit with `import('...')` dynamic import or a fetch in Session B if it bothers the user.
- No empty state for the dashboard yet (RequireSetup should make this unreachable, but a defensive fallback is cheap).
- No loading state for the engine compute (it's synchronous and fast, but a flash on slow devices is possible).

---

## Phase 1 — Schema enrichment + tech-electives ingest  ✅ DONE

**Goal:** add prerequisites + mutual-exclusion + attribute support to `courses.json`, and ingest the tech-electives course list as the first attribute-tagged source.

**Steps:**
1. Save the user-pasted tech-electives JSON verbatim to `src/data/raw/tech_electives_raw.json` (refreshable, version-controllable).
2. Extend the `courses.json` per-course schema:
   - `prerequisites: string[]` — list of course IDs (empty for now; populated by Phase 2).
   - `mutuallyExclusive: string[]` — list of course IDs (empty for now; populated by Phase 2).
   - `tech_elective_status: null | "unrestricted" | "restricted" | "ask"` — populated by Phase 1 normalizer for courses on the tech-electives list. Used by the LLM advisor for nuance ("this counts but check with your advisor").
   - `attributes: string[]` — already exists, will hold values like `"TECH_ELECTIVE"`, `"EUNS"`, `"EUSS"`, etc.
3. Write `scripts/ingest/normalizeTechElectives.mjs` (Node, no extra deps):
   - Read `src/data/raw/tech_electives_raw.json`.
   - Normalize `course4d` IDs from `"ACCT 1010"` → `"ACCT1010"` (strip spaces).
   - Filter to entries where `status` is `"unrestricted"` / `"restricted"` / `"ask"`. Drop `"no"`.
   - For each kept entry: if course already exists in `courses.json`, merge `attributes: ["TECH_ELECTIVE"]` and set `tech_elective_status`. Otherwise create a new entry with title from the source, level parsed from the course number, default `cu: 1`.
   - Write back to `src/data/courses.json`.
4. Update `src/data/programs.json` `tech_electives` requirement to use `from: { "attribute": "TECH_ELECTIVE" }` (was `["CIS_TECH","EUNG"]`).
5. Re-run `node scripts/sanity.mjs`. Verify the partial-junior case now picks up tech electives if the student has any.

**Decisions locked in:**
- Course IDs are normalized to no-space (`"CIS1100"`).
- Tech electives use the single attribute `"TECH_ELECTIVE"`. Status (`unrestricted`/`restricted`/`ask`) lives in `tech_elective_status`, not as a separate attribute, so the engine treats them uniformly while the LLM advisor can read the status for nuance.
- `"no"` courses from the tech-electives source are dropped entirely (not stored).
- The normalizer is **idempotent** — re-running it never duplicates entries or overwrites existing fields beyond the ones it owns.

---

## Phase 2A — Attribute ingest  ✅ DONE 2026-04-07

**Goal:** ingest every course list referenced by an attribute or tag in `programs.json`, so attribute-based requirements (nat-sci elective, SS/H, TBS, writing seminar) can actually evaluate against real Penn data.

**Attributes inventoried** (from programs.json):
| Attribute / tag | Used by | Source URL | Result |
|---|---|---|---|
| `TECH_ELECTIVE` | tech_electives | `advising.cis.upenn.edu/...json` | Phase 1 (362 courses) |
| `EUNS` | math.natsci | `catalog.upenn.edu/attributes/euns/` | 312 courses |
| `EUSS` | gen.ssh3, gen.ssh_or_tbs2 | `catalog.upenn.edu/attributes/euss/` | 1,324 courses |
| `EUHS` | gen.ssh3, gen.ssh_or_tbs2 | `catalog.upenn.edu/attributes/euhs/` | 4,503 courses |
| `EUTB` | gen.ssh_or_tbs2 | `catalog.upenn.edu/attributes/eutb/` | 64 courses |
| `writing_seminar` (tag) | constraint inside gen.ssh3 | SEAS handbook writing-courses page | 49 courses |

**Important corrections found during ingest** (now in programs.json):
- Penn calls humanities `EUHS`, not `EUHM`.
- Penn calls Tech/Business/Society `EUTB`, not `EUTBS`.
- General Electives is **8 CU**, not 7. (5+7+12+2+3+8 = 37, matching the PDF total. Earlier 7 was a transcription error.)

**Files created:**
- `scripts/ingest/fetchAttribute.mjs` — generic, parameterized: `node fetchAttribute.mjs euns` etc. Caches HTML in `src/data/raw/attributes/<code>.html`. Idempotent.
- `scripts/ingest/fetchWritingSeminars.mjs` — separate because the source is a SEAS handbook page (regex over body text), not a catalog `.sc_courselist` table. Tags matched courses with `tags: ["writing_seminar"]`.

**Engine fix during this phase:**
- `degreeEngine.js` was merging catalog `attributes` into student courses but forgetting `tags`. Fixed: tags are now merged the same way attributes are, so the `must_include_tag` constraint correctly recognizes WRIT* courses as writing seminars.

**Final state of `courses.json`: 6,242 entries.**

**Sanity test passes:**
- Case E (full coverage student) — 37/37 CU, every leaf complete, no warnings. ✅
- All earlier cases (A/B/C/D) still pass.

---

## Phase 2B — Catalog scraper for prereqs + mutex  ✅ DONE 2026-04-07

**Goal:** populate `prerequisites` and `mutuallyExclusive` for every *relevant* course in `courses.json` by scraping `catalog.upenn.edu`.

**Scope adjustment after Phase 2A:** `courses.json` ballooned from 414 → 6,242 entries because EUHS alone added 4,503 humanities courses. Scraping all 6,242 detail pages at 500ms rate limit would take ~52 minutes — wasteful, since 99% of humanities courses have no meaningful prereq chains for AI BSE planning. **The Phase 2B scraper will filter to STEM-relevant departments only on the first pass:** CIS, ESE, NETS, MATH, MEAM, BE, CBE, MSE, ENGR, ENM, BIOL, CHEM, PHYS, STAT, ECON, COGS, LING, PHIL (the cog-sci elective list). Estimated: ~1,200 courses, ~10 minutes cold scrape. Other departments scraped on demand later.

**Steps:**
1. Write `scripts/ingest/scrapeCatalog.mjs`:
   - For each course id matching the STEM filter, build the URL `https://catalog.upenn.edu/search/?P=<DEPT>%20<NUMBER>`.
   - Cache raw HTML to `src/data/raw/catalog_cache/<COURSE_ID>.html`. Skip the network call if cached.
   - Parse the `courseblock` div: find `<p class="courseblockextra">` paragraphs, then for each:
     - If text starts with `"Prerequisite:"` → extract `<a class="bubblelink code">` links → list of normalized course IDs.
     - If text starts with `"Mutually Exclusive:"` → same pattern.
   - Merge into `courses.json` (idempotent).
2. Rate limit: 500 ms between live fetches.
3. `--force` flag bypasses the cache for full refresh.
4. `--all` flag bypasses the STEM filter to scrape every course in `courses.json` (use sparingly).

**Reusable insight from the prior `academic-manager` Python codebase:**
- The `<p class="courseblockextra">` selector and `<a class="bubblelink code">` extraction worked reliably there. Port the pattern, don't reinvent.
- That codebase only got prereqs for 15% of courses because it skipped detail-page fetches for secondary sources. **We must fetch every relevant course's detail page**, no shortcuts.
- That codebase never extracted mutex at all — even though it's in the same `<p>` paragraph as prereqs. Don't repeat that miss.

**Files created:**
- `scripts/ingest/scrapeCatalog.mjs` — STEM-filtered detail-page scraper. Fetches `catalog.upenn.edu/search/?P=<DEPT>%20<NUMBER>` for each course in the STEM department whitelist, parses the `<h3>` (for title) plus `<p class="courseblockextra noindent">` paragraphs (for `Prerequisite:` and `Mutually Exclusive:` lines), merges into `courses.json`. Caches per-course HTML, idempotent. Flags: `--all` (bypass STEM filter), `--force` (bypass cache).

**Result:**
- 729 STEM courses considered, **717 successfully parsed**, 12 not found (mostly renamed/retired courses + the `CIS 2210` typo from the tech-electives source).
- **50% of STEM courses now have prerequisites** (prior `academic-manager` got 15%).
- **19% have mutual exclusion** (prior project: 0%).
- Cross-listed undergrad/grad pairs (CIS 4190 ↔ CIS 5190, CIS 5210 ↔ CIS 4210, etc.) are correctly identified as mutex pairs.
- Cached HTML lives in `src/data/raw/catalog_cache/<COURSE_ID>.html` (729 files, ~22 MB).

**One bug found and fixed during this phase:**
- Initial parser looked for the title in a `<p class="courseblocktitle">` element inside `div.courseblock`. The actual catalog layout puts the title in an `<h3>` *outside* the courseblock. Fixed: now finds any `<h3>` whose code matches the expected id, then parses the first `div.courseblock` for prereq/mutex paragraphs.

---

---

## Phase 3 — Engine support for prereqs + mutex  ✅ DONE 2026-04-07

**Goal:** the engine surfaces prereq violations and mutex conflicts as warnings (not hard fails).

**Steps:**
1. In `degreeEngine.js`, after the assignment solver runs, walk the consumed courses:
   - For each consumed course, check that every entry in its `prerequisites` is also in the student's completed list. If not, append `prereq_violation` to warnings.
   - For each pair of consumed courses, if either's `mutuallyExclusive` contains the other, append `mutex_conflict` to warnings.
2. Add to `CompletionStatus`:
   - `prereqViolations: Array<{courseId, missing: string[]}>`
   - `mutexConflicts: Array<{courseA: string, courseB: string}>`
3. Dedupe rule for `courses.json`: when ingesting from multiple sources (tech-electives JSON + catalog scraper), the course-detail page is authoritative for `title`, `cu`, `level`. Tech-electives JSON only sets `attributes` and `tech_elective_status`.
4. Sanity test additions: Case F — student took CIS4190 without CIS1210 (prereq) → expect `prereqViolations` populated. Case G — student took both CIS4190 and CIS5190 (mutex pair) → expect `mutexConflicts` populated.

**Result:** both new arrays land on `CompletionStatus`. Cases F and G pass. As a bonus, Case G's junior baseline surfaced a real subtle curriculum issue: `ESE4020 is missing: STAT4300` — ESE4020 accepts only STAT4300 as a prereq, but the Math/Sci Probability slot also accepts ESE3010. A student who picks ESE3010 to satisfy Probability cannot then take ESE4020; they'd have to take ESE5420 instead. This is exactly the kind of accounting error the advisor needs to catch — and now does, automatically.

---

## Phase 4 — UI/UX Pro Max skill installation + Dashboard scaffolding  📋 PLANNED

**Goal:** install the design-intelligence skill and start the first real React component (the dashboard).

**Steps:**
1. `npm install -g uipro-cli`
2. `uipro init --ai claude --global` (installs to `~/.claude/skills/ui-ux-pro-max/`).
3. Verify the skill loads (check `~/.claude/skills/`).
4. Use the skill to design and scaffold `src/components/Dashboard/` — the first real UI for visualizing the `CompletionStatus` tree.

**Decisions locked in:**
- User decided 2026-04-07: defer skill install until Phase 4. Don't install during data work.

---

## Out of scope (deferred indefinitely)

- Scraping/ingesting the other 5 SEAS elective lists (nat sci, engineering, SS breadth, SS depth, TBS, free electives). Will revisit after Phase 3 if attribute-based requirements need broader course coverage.
- Minor degree trees (`minors.json` is an empty stub).
- Real database (still localStorage MVP).
- Authentication / multi-user.
- Recommended-path-for-next-semester logic (separate phase, post-Phase 4).
