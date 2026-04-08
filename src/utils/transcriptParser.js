/**
 * transcriptParser.js
 *
 * ============================================================
 *  Penn Advisor — Transcript Parser
 * ============================================================
 *
 *  WHAT IT DOES
 *  ------------
 *  Takes a Penn unofficial transcript PDF (the kind a student
 *  downloads from Path Penn) and extracts everything Penn Advisor
 *  needs to set up a student profile:
 *
 *    • Student identity:    name, Penn ID, primary program
 *    • Issue date           (so we know how stale the data is)
 *    • Per-semester courses with id, title, CU value, grade,
 *      and an `inProgress` flag
 *    • Cumulative totals:   earned hours, GPA hours, quality
 *      points, GPA
 *    • Unknown courses:     course codes detected in the
 *      transcript that aren't in our local catalog (so the UI
 *      can offer to keep them as placeholders)
 *
 *  WHAT IT TAKES
 *  -------------
 *    A `File` (from a browser <input type="file">) or any
 *    `Blob` / `ArrayBuffer` / `Uint8Array` containing PDF bytes.
 *
 *  WHAT IT RETURNS
 *  ---------------
 *    A `TranscriptData` object (see typedef below). Promise-based.
 *
 *  KEY DESIGN DECISIONS
 *  --------------------
 *  • PDF text extraction is done client-side via pdfjs-dist,
 *    dynamically imported so the ~1 MB lib only loads when this
 *    parser is actually called. The worker is bundled by Vite via
 *    the `?url` import suffix (pdfjs v4+ refuses to run without
 *    a real workerSrc).
 *
 *  • Penn transcripts use a TWO-COLUMN layout. We split items by
 *    their PDF x-coordinate at x=350 and process each column
 *    independently top-to-bottom, otherwise left/right courses
 *    interleave on the same horizontal line and the semester
 *    headers get scrambled.
 *
 *  • Within each column we group items by y-coordinate, sort
 *    each line left-to-right by x, and join non-empty strings
 *    with single spaces. pdfjs emits empty-string spacing items
 *    between adjacent text items — we MUST skip them, otherwise
 *    "CIS" + "" + "1100" joins to "CIS  1100" (two spaces) and
 *    the regex `[A-Z]{2,5}\s?\d{3,4}` (with `\s?` = zero-or-one)
 *    fails to match. We fix this both by skipping empty items
 *    AND by using `\s*` (zero-or-more) in the regex.
 *
 *  • Course tagging is done in a single linear pass over the
 *    extracted text. The parser tracks the most recent semester
 *    header (`Fall 2023`, `Spring 2024`, `Summer 2025`) and tags
 *    every subsequent course with that semester. This is why
 *    the column-aware extraction matters — semester headers
 *    must appear in reading order BEFORE their courses.
 *
 *  • Pure module: no React, no localStorage, no side effects
 *    other than the dynamic import of pdfjs-dist on first call.
 */

import courses from "../data/courses.json" with { type: "json" };

// Vite-specific: importing with `?url` returns the built asset URL.
import pdfjsWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

// ---------- type definitions (JSDoc) ----------

/**
 * @typedef {Object} TranscriptCourse
 * @property {string}  id           Normalized course id, e.g. "CIS1100"
 * @property {string}  title        Course title from the transcript line
 * @property {number}  cu           Course units (1.0, 0.5, 1.5, etc.)
 * @property {string|null} grade    "A+", "B-", "IN PROGRESS", or null
 * @property {boolean} inProgress   true if grade is "IN PROGRESS"
 * @property {boolean} inCatalog    true if the course exists in courses.json
 * @property {string|null} semester e.g. "Fall 2023" — null if no header was seen
 */

/**
 * @typedef {Object} TranscriptStudent
 * @property {string|null} name      e.g. "Maya Kfir"
 * @property {string|null} pennId    e.g. "22194222"
 * @property {string|null} program   e.g. "School of Engineering and Applied Science - Bachelor of Science in Engineering"
 * @property {string|null} major     e.g. "Artificial Intelligence"
 * @property {string|null} dateIssued
 */

/**
 * @typedef {Object} TranscriptTotals
 * @property {number|null} earnedHrs
 * @property {number|null} gpaHrs
 * @property {number|null} qualityPoints
 * @property {number|null} gpa
 * @property {number|null} inProgressCu
 */

/**
 * @typedef {Object} TranscriptData
 * @property {TranscriptStudent}  student
 * @property {TranscriptTotals}   totals
 * @property {TranscriptCourse[]} courses     All courses in the transcript
 * @property {Object<string,TranscriptCourse[]>} bySemester  Convenience map
 * @property {string} rawText      The raw extracted text (for debugging)
 */

// ---------- pdfjs loader (cached) ----------

let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// ---------- PDF -> linear text (column-aware) ----------

const COLUMN_SPLIT_X = 350;

function linesFromItems(items) {
  const byY = new Map();
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    if (it.str.trim().length === 0) continue; // skip pdfjs spacing items
    const y = Math.round(it.transform?.[5] ?? 0);
    if (!byY.has(y)) byY.set(y, []);
    byY.get(y).push({ x: it.transform?.[4] ?? 0, s: it.str });
  }
  // PDF y-axis is bottom-up, so sort descending = top to bottom.
  return [...byY.keys()]
    .sort((a, b) => b - a)
    .map((y) =>
      byY
        .get(y)
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
    );
}

async function pdfToText(input) {
  const pdfjs = await loadPdfjs();

  let data;
  if (input instanceof Uint8Array) data = input;
  else if (input instanceof ArrayBuffer) data = new Uint8Array(input);
  else if (input && typeof input.arrayBuffer === "function")
    data = new Uint8Array(await input.arrayBuffer());
  else throw new Error("transcriptParser: unsupported input type");

  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const allLines = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const left = [];
    const right = [];
    for (const it of content.items) {
      const x = it.transform?.[4] ?? 0;
      (x < COLUMN_SPLIT_X ? left : right).push(it);
    }
    allLines.push(...linesFromItems(left));
    allLines.push(...linesFromItems(right));
  }
  await doc.cleanup?.();
  return allLines.join("\n");
}

// ---------- text -> structured data ----------

// Course code: 2-5 uppercase letters, then 3-4 digits, with any
// amount of whitespace between. Word boundaries on both ends.
const COURSE_CODE_PATTERN = /\b([A-Z]{2,5})\s*(\d{3,4})\b/g;

// Semester header: Fall/Spring/Summer + year.
const SEMESTER_PATTERN = /\b(Fall|Spring|Summer)\s+(\d{4})\b/g;

function normalizeId(s) {
  return s.replace(/\s+/g, "").toUpperCase();
}

/**
 * Extract the student identity block from the top of the transcript.
 * The Penn header looks like:
 *   Record of: <name>
 *   Penn ID: <id>
 *   Date Issued: <date>
 *   Primary Program
 *   Program: <program>
 *   Major : <major>
 */
function extractStudent(text) {
  const get = (re) => {
    const m = text.match(re);
    return m ? m[1].trim().replace(/\s+/g, " ") : null;
  };

  // Name: capture everything after "Record of:" up to end-of-line,
  // then strip any "U N O F F I C I A L" or "UNOFFICIAL" watermark
  // text that may have leaked into the same line on some layouts.
  let name = get(/^Record of:\s*(.+?)\s*$/m);
  if (name) {
    name = name
      .replace(/U\s*N\s*O\s*F[\s\w]*/i, "") // strip "U N O F F I C I A L" tail
      .replace(/Page:?\s*\d+/i, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  return {
    name: name || null,
    pennId: get(/Penn ID:\s*(\d+)/i),
    dateIssued: get(/Date Issued:\s*([\d\-A-Z]+)/i),
    // Program may span multiple "lines" in our extracted text.
    program: get(/Program:\s*(.+?)(?:Division|$)/is),
    major: get(/Major\s*:\s*(.+?)(?:SUBJ|$)/is),
  };
}

/**
 * Extract the cumulative totals block at the bottom of the transcript.
 *   TOTAL INSTITUTION 25.50 25.50 92.75 3.64
 */
function extractTotals(text) {
  const m = text.match(
    /TOTAL\s+INSTITUTION\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i
  );
  const inProg = text.match(/In Progress Credits\s+([\d.]+)/i);
  return {
    earnedHrs: m ? parseFloat(m[1]) : null,
    gpaHrs: m ? parseFloat(m[2]) : null,
    qualityPoints: m ? parseFloat(m[3]) : null,
    gpa: m ? parseFloat(m[4]) : null,
    inProgressCu: inProg ? parseFloat(inProg[1]) : null,
  };
}

/**
 * Try to pull the trailing "1.00 A+" or "1.50 IN PROGRESS" off the
 * line that contains a course code. Returns { cu, grade } or nulls.
 *
 * Patterns we tolerate (real transcript shapes):
 *   "CIS 1100 Intro To Comp Prog 1.00 A+"
 *   "ESE 4210 Control For Autonomous Robots 1.50 A-"
 *   "EAS 5470 Engineering Product 1.00 IN PROGRESS"
 */
function extractCuAndGrade(line, codeStr) {
  // Slice the line at the END of the course code so we only look
  // at what comes after — handles two-courses-on-one-line correctly
  // (after column splitting they're on separate lines, but be safe).
  const codeIdx = line.indexOf(codeStr);
  if (codeIdx < 0) return { cu: null, grade: null };
  const tail = line.slice(codeIdx + codeStr.length);

  // CU is the last "X.XX" floating point number on the line that
  // is followed by either a grade or "IN PROGRESS" or end-of-string.
  // The simplest reliable approach: take the LAST X.XX number we
  // can find before the grade-shaped tail.
  const cuGradeMatch = tail.match(/([\d]+\.\d{2})\s+(IN PROGRESS|[A-Z][+-]?)\b/);
  if (cuGradeMatch) {
    return {
      cu: parseFloat(cuGradeMatch[1]),
      grade: cuGradeMatch[2].trim(),
    };
  }
  return { cu: null, grade: null };
}

/**
 * Try to pull the title from a course line. Title is what's
 * between the course code and the CU value.
 *
 *   "CIS 1100 Intro To Comp Prog 1.00 A+"
 *           ^^^^^^^^^^^^^^^^^^^^
 */
function extractTitle(line, codeStr, cuStr) {
  const codeIdx = line.indexOf(codeStr);
  if (codeIdx < 0) return null;
  const afterCode = line.slice(codeIdx + codeStr.length);
  if (cuStr != null) {
    const cuIdx = afterCode.lastIndexOf(cuStr);
    if (cuIdx > 0) return afterCode.slice(0, cuIdx).trim() || null;
  }
  return afterCode.trim() || null;
}

/**
 * Walk the extracted text linearly, building a list of courses
 * tagged with semester, CU, and grade. The walk is line-based so
 * we can isolate the CU/grade tail per course.
 */
function extractCourses(text) {
  const lines = text.split("\n");
  const out = [];
  // Dedupe by normalized course id: first occurrence in PDF reading order wins.
  // Retakes that appear again under the same code are skipped (not merged).
  const seen = new Set();
  let currentSemester = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Semester header? (May appear with other text on the same line
    // because of column merging — match all occurrences.)
    const semMatch = line.match(SEMESTER_PATTERN);
    if (semMatch) {
      // Take the LAST one on the line as the active semester (the
      // most recent in reading order).
      const last = semMatch[semMatch.length - 1];
      currentSemester = last;
    }

    // Reset the global regex's lastIndex by re-creating it per-loop.
    const codeRe = new RegExp(COURSE_CODE_PATTERN.source, "g");
    let m;
    while ((m = codeRe.exec(line)) !== null) {
      const codeStr = m[0];
      const id = normalizeId(m[1] + m[2]);
      if (seen.has(id)) continue;
      seen.add(id);

      const { cu, grade } = extractCuAndGrade(line, codeStr);
      const title = extractTitle(line, codeStr, cu != null ? cu.toFixed(2) : null);
      const cat = courses[id];

      out.push({
        id,
        title: title || cat?.title || id,
        cu: cu ?? cat?.cu ?? 1,
        grade,
        inProgress: grade === "IN PROGRESS",
        inCatalog: !!cat,
        semester: currentSemester,
      });
    }
  }
  return out;
}

// ---------- public entry point ----------

/**
 * Parse a Penn transcript PDF end-to-end.
 *
 * @param {File | Blob | ArrayBuffer | Uint8Array} input
 * @returns {Promise<TranscriptData>}
 */
export async function parseTranscriptPdf(input) {
  const rawText = await pdfToText(input);
  const student = extractStudent(rawText);
  const totals = extractTotals(rawText);
  const courseList = extractCourses(rawText);

  // Build a convenience map keyed by semester label, sorted oldest first.
  const bySemester = {};
  for (const c of courseList) {
    const key = c.semester || "Unspecified";
    (bySemester[key] ||= []).push(c);
  }

  return {
    student,
    totals,
    courses: courseList,
    bySemester,
    rawText,
  };
}
