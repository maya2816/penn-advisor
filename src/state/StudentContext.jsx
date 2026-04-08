import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { computeCompletion } from "../utils/degreeEngine.js";
import { getStudent, setStudent as persistStudent, clearAll } from "../utils/storage.js";

/**
 * StudentContext — single source of truth for the student's program,
 * completed courses, identity profile, and the cached
 * `computeCompletion()` result.
 *
 * Hydrates from localStorage on mount; persists on every change.
 * `completion` is memoized so the engine only re-runs when its
 * inputs actually change.
 *
 * Stored shape (in localStorage):
 *   {
 *     programId: "SEAS_AI_BSE",
 *     completedCourses: [{ id, semester?, cu?, grade?, inProgress? }, ...],
 *     profile: { name, pennId, program, major, dateIssued, gpa, ... } | null
 *   }
 */

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  // Hydrate synchronously so first paint already has the right state.
  const [programId, setProgramId] = useState(() => getStudent()?.programId ?? null);
  const [completedCourses, setCompletedCourses] = useState(
    () => getStudent()?.completedCourses ?? []
  );
  const [profile, setProfile] = useState(() => getStudent()?.profile ?? null);

  // Persist on every change.
  useEffect(() => {
    if (programId && completedCourses.length > 0) {
      persistStudent({ programId, completedCourses, profile });
    }
  }, [programId, completedCourses, profile]);

  // Cached completion. Recomputes only when inputs change.
  const completion = useMemo(() => {
    if (!programId || completedCourses.length === 0) return null;
    return computeCompletion(completedCourses, programId);
  }, [programId, completedCourses]);

  const reset = useCallback(() => {
    clearAll();
    setProgramId(null);
    setCompletedCourses([]);
    setProfile(null);
  }, []);

  const value = {
    programId,
    completedCourses,
    profile,
    completion,
    setProgramId,
    setCompletedCourses,
    setProfile,
    reset,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside <StudentProvider>");
  return ctx;
}
