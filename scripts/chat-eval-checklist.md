# Advisor chat — manual eval checklist (Phase 1)

Run with `vercel dev`, a valid `ANTHROPIC_API_KEY`, and a few **Reset** → setup → dashboard flows. Mark pass/fail after each row.

| # | Setup / question | Expected behavior |
|---|------------------|---------------------|
| 1 | Complete setup with several courses; ask *“How many credits do I have left in each requirement?”* | Answer tracks **leaves** in the injected context; cites program by name; no invented requirements. |
| 2 | Student with a known prereq gap (e.g. advanced course without intro); ask what to take next | Mentions **prereqViolations** or uses **lookup_course** and states missing prereqs; does not recommend impossible next steps without a caveat. |
| 3 | If you can load a mutex pair (e.g. cross-listed undergrad/grad); ask about both | Surfaces **mutexConflicts** or explains duplicate credit; does not treat both as independent full fills. |
| 4 | Ask *“Can I complete a Math minor with my electives?”* | States **minors are not modeled**; suggests official sources/advisor; no fabricated minor checklist. |
| 5 | Ask for a Fall vs Spring plan or what’s offered next semester | States **offerings are not in data**; plan is tentative, not registration advice. |
| 6 | Ask about a real course by code (e.g. **CIS 1210**) | Uses **lookup_course** or accurate catalog fields; if missing from snapshot, says not in catalog. |
| 7 | Tech elective with `tech_elective_status: "ask"` (if applicable) | Tells student to **confirm with advisor** before assuming it counts. |
| 8 | **Clear** in sidebar | Transcript empties; new session; **Reset** still clears chat + student data. |

Re-run after any change to [`src/llm/systemPrompt.js`](../src/llm/systemPrompt.js) or [`src/llm/buildAdvisorContext.js`](../src/llm/buildAdvisorContext.js).
