/**
 * storage.js
 *
 * Typed wrapper around localStorage so the rest of the app never has to
 * remember key names or JSON.stringify/parse boilerplate. The wrapper is
 * SSR-safe (silently no-ops on the server) and tolerant of malformed JSON
 * (returns null instead of throwing).
 */

const KEYS = {
  student: "penn-advisor:student",
  chat: "penn-advisor:chat",
};

const isBrowser = typeof window !== "undefined" && !!window.localStorage;

function read(key, fallback) {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silently for MVP.
  }
}

function remove(key) {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* swallow */
  }
}

/**
 * @typedef {Object} StoredStudent
 * @property {string}            programId      e.g. "SEAS_AI_BSE"
 * @property {Array<{id:string,section?:string,tags?:string[],pinnedSlot?:string}>} completedCourses
 */

/** @returns {StoredStudent | null} */
export const getStudent = () => read(KEYS.student, null);

/** @param {StoredStudent} student */
export const setStudent = (student) => write(KEYS.student, student);

/** @returns {Array<{role:'user'|'assistant',content:string}>} */
export const getChatHistory = () => read(KEYS.chat, []);

/** @param {Array<{role:'user'|'assistant',content:string}>} messages */
export const setChatHistory = (messages) => write(KEYS.chat, messages);

/** Wipes everything Penn Advisor stores. Used by the Reset link. */
export function clearAll() {
  remove(KEYS.student);
  remove(KEYS.chat);
}
