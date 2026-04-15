/**
 * pcrClient.js
 *
 * The Penn Course Review API client for Penn Advisor.
 *
 * WHAT IT DOES
 * ------------
 * Wraps the Penn Labs Penn Courses API
 * (https://penncoursereview.com/api/base/) behind four async functions:
 *
 *   - fetchCourse(courseId)         GET single course detail
 *   - searchCourses({query, ...})   GET search results
 *   - fetchReviews(courseId, token) GET review aggregates (auth required)
 *   - fetchCatalogDump(semester)    GET full catalog snapshot
 *
 * Designed to run in BOTH the browser (called from React components)
 * AND in serverless functions (called from api/chat.js). It uses
 * native `fetch`, which is available in all modern environments.
 *
 * KEY DESIGN DECISIONS
 * --------------------
 *
 *   1. ID NORMALIZATION HAPPENS HERE. Callers can pass course IDs in
 *      either format ("CIS-4190" or "CIS4190") and the client converts
 *      to PCR's canonical dash format internally. Response data flows
 *      through unchanged — downstream code calls `normalizePcrId` if it
 *      needs the no-separator form.
 *
 *   2. NEVER THROWS ON HTTP ERRORS. Every function returns
 *      `{ ok: true, data }` on success or `{ ok: false, error }` on
 *      failure. Throwing inside a chat tool or a build script makes
 *      debugging miserable; structured returns let callers degrade
 *      gracefully.
 *
 *   3. UNAUTHENTICATED BY DEFAULT. The bulk of PCR's catalog data
 *      (courses, sections, attributes, ratings) is publicly accessible
 *      without a token. Only the deep `/api/review/...` endpoints
 *      require Penn Labs OAuth. This client only attaches a Bearer
 *      token when one is explicitly provided to `fetchReviews()`.
 *
 *   4. TINY IN-MEMORY CACHE. Build scripts typically hit thousands of
 *      endpoints; the chat advisor often re-asks the same lookup_course
 *      tool within a single conversation. A keyed cache with a 1-hour
 *      TTL eliminates duplicate round-trips without leaking memory
 *      across requests.
 *
 *   5. CONFIGURABLE FOR TESTABILITY. `init({fetch, baseUrl, ttlMs})`
 *      lets tests inject a stub fetch and override defaults. Production
 *      callers don't need to call init().
 *
 * KNOWN PCR API LIMITATIONS (verified against the live endpoint
 * 2026-04-09):
 *
 *   - The `prerequisites` field on a course is a plain string (often
 *     empty). Penn's structured prereq data is not reliable; if you
 *     need real prereq chains, fall back to our scraped courses.json.
 *
 *   - The `crosslistings` field is sometimes empty for courses we know
 *     have aliases (e.g., CIS-4190 / CIS-5190). Don't trust the
 *     absence of a crosslisting — only the presence.
 *
 *   - The full catalog dump endpoint (`semester=all`) is documented as
 *     "significantly more expensive" — use sparingly and cache.
 */

import { internalIdToPcr } from "./normalizePcrId.js";

// ---------- module configuration ----------

const DEFAULT_BASE_URL = "https://penncoursereview.com";
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

let config = {
  baseUrl: DEFAULT_BASE_URL,
  fetch: typeof fetch !== "undefined" ? fetch : null,
  ttlMs: DEFAULT_TTL_MS,
};

/**
 * Override the default configuration. Optional — production callers
 * don't need to call this. Tests inject a fake fetch via this.
 *
 * @param {Object} overrides
 * @param {string} [overrides.baseUrl]
 * @param {Function} [overrides.fetch]
 * @param {number} [overrides.ttlMs]
 */
export function init(overrides = {}) {
  config = { ...config, ...overrides };
}

// ---------- in-memory cache ----------

const cache = new Map(); // key: full URL string → { expiresAt, value }

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key, value) {
  cache.set(key, { expiresAt: Date.now() + config.ttlMs, value });
}

/** Wipes the cache. Useful in tests and when forcing a refresh. */
export function clearCache() {
  cache.clear();
}

// ---------- the core fetch helper ----------

/**
 * Build a full URL from a path + query object. Encodes query params.
 */
function buildUrl(path, query = {}) {
  const url = new URL(path, config.baseUrl);
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * The single GET helper that every public function delegates to.
 * Handles caching, header construction, and error wrapping.
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {string} [options.token] Bearer token for authenticated endpoints
 * @param {boolean} [options.bypassCache] Skip the cache entirely
 * @returns {Promise<{ ok: true, data: any } | { ok: false, error: string, status?: number }>}
 */
async function getJson(url, { token, bypassCache } = {}) {
  if (!config.fetch) {
    return { ok: false, error: "pcrClient: no global fetch available; call init({fetch})" };
  }

  if (!bypassCache) {
    const cached = cacheGet(url);
    if (cached !== undefined) return { ok: true, data: cached };
  }

  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await config.fetch(url, { headers });
  } catch (err) {
    return { ok: false, error: `pcrClient: network error — ${err?.message || String(err)}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: `pcrClient: HTTP ${res.status} for ${url}`,
    };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    return { ok: false, error: `pcrClient: invalid JSON in response — ${err?.message || String(err)}` };
  }

  if (!bypassCache) cacheSet(url, data);
  return { ok: true, data };
}

// ---------- public API ----------

/**
 * Fetch the full detail for a single course. Public/unauthenticated.
 *
 * Accepts course IDs in either format ("CIS-4190" or "CIS4190").
 *
 * Response shape (verified against the live API):
 *   {
 *     id: "CIS-4190",
 *     title: "Applied Machine Learning",
 *     description: "...",
 *     syllabus_url: string | null,
 *     semester: "2026C",
 *     prerequisites: string,           // often empty; unreliable
 *     course_quality: number,          // 0-4 scale
 *     instructor_quality: number,
 *     difficulty: number,
 *     work_required: number,
 *     credits: number | null,
 *     crosslistings: string[],         // often incomplete
 *     pre_ngss_requirements: object[],
 *     attributes: Array<{ code, school, description }>,
 *     restrictions: object[],
 *     sections: Array<{
 *       id, status, activity, credits, capacity, semester,
 *       meetings, instructors, course_quality, ...
 *     }>
 *   }
 *
 * @param {string} courseId
 * @param {Object} [options]
 * @param {string} [options.semester="current"]
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function fetchCourse(courseId, { semester = "current" } = {}) {
  const pcrId = internalIdToPcr(courseId);
  if (!pcrId) {
    return { ok: false, error: `pcrClient.fetchCourse: not a valid course id: ${courseId}` };
  }
  const url = buildUrl(`/api/base/${semester}/courses/${pcrId}/`);
  return getJson(url);
}

/**
 * Search the catalog. Public/unauthenticated.
 *
 * @param {Object} params
 * @param {string} [params.query]      Course-code fragment OR keyword OR professor name
 * @param {string} [params.attributes] Boolean expression like "(EUHS|EUSS)*(QP|QS)"
 * @param {string} [params.semester="current"]
 * @param {string} [params.cu]         Range like "0-1.5"
 * @param {string} [params.difficulty] Range like "0-2.5"
 * @returns {Promise<{ ok: true, data: object[] } | { ok: false, error: string }>}
 */
export async function searchCourses({
  query,
  attributes,
  semester = "current",
  cu,
  difficulty,
} = {}) {
  const url = buildUrl(`/api/base/${semester}/search/courses/`, {
    search: query,
    attributes,
    cu,
    difficulty,
  });
  return getJson(url);
}

/**
 * Fetch the full review aggregate for a single course.
 * REQUIRES a Penn Labs Bearer token; without one, returns
 * `{ ok: false, error: "auth required" }`.
 *
 * Token is currently obtained by:
 *   1. Logging in to penncoursereview.com in a browser
 *   2. DevTools → Network → copying the Authorization header
 *   3. Storing as PCR_TOKEN (server) or VITE_PCR_TOKEN (client)
 *
 * Real OAuth integration with the Penn Labs Accounts Engine is a
 * future phase; for the demo, the copy-paste workflow is fine.
 *
 * @param {string} courseId
 * @param {string|null} token
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function fetchReviews(courseId, token) {
  if (!token) {
    return { ok: false, error: "pcrClient.fetchReviews: PCR_TOKEN not provided" };
  }
  const pcrId = internalIdToPcr(courseId);
  if (!pcrId) {
    return { ok: false, error: `pcrClient.fetchReviews: not a valid course id: ${courseId}` };
  }
  const url = buildUrl(`/api/review/course/${pcrId}`);
  return getJson(url, { token });
}

/**
 * Fetch the entire catalog snapshot for a given semester (or 'all'
 * for one row per unique course id, the most recent offering).
 *
 * Used by the build-time ingest script (fetchPcrCatalog.mjs) — NOT
 * intended to be called from the runtime app. The endpoint is "much
 * more expensive" per Penn Labs docs.
 *
 * @param {Object} [options]
 * @param {string} [options.semester="current"]  "current", "all", "2026C", etc.
 * @returns {Promise<{ ok: true, data: object[] } | { ok: false, error: string }>}
 */
export async function fetchCatalogDump({ semester = "current" } = {}) {
  const url = buildUrl(`/api/base/${semester}/courses/`);
  return getJson(url, { bypassCache: true }); // always fresh for ingest runs
}

// ---------- diagnostic helpers ----------

/**
 * Returns the current cache size (entries). Useful for telemetry and
 * debugging. Not part of the stable public API.
 */
export function _cacheSize() {
  return cache.size;
}
