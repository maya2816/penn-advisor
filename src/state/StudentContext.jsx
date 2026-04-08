import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import programs from "../data/programs.json" with { type: "json" };
import { computeCompletion } from "../utils/degreeEngine.js";
import { getStudent, setStudent as persistStudent, clearAll } from "../utils/storage.js";

/**
 * StudentContext.jsx
 *
 * Role: Single source of truth for primary program, completed courses,
 * optional profile (from transcript), and memoized degree completion.
 *
 * Inputs: localStorage `penn-advisor:student` via storage.js.
 * Outputs: Context value + persistence when programId and ≥1 course exist.
 * Depends on: programs.json (valid major program ids), degreeEngine.
 */

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  const [programId, setProgramId] = useState(() => getStudent()?.programId ?? null);
  const [completedCourses, setCompletedCourses] = useState(
    () => getStudent()?.completedCourses ?? []
  );
  const [profile, setProfile] = useState(() => getStudent()?.profile ?? null);

  useEffect(() => {
    if (programId && !programs[programId]) {
      clearAll();
      setProgramId(null);
      setCompletedCourses([]);
      setProfile(null);
    }
  }, [programId]);

  useEffect(() => {
    if (programId && completedCourses.length > 0) {
      persistStudent({ programId, completedCourses, profile });
    }
  }, [programId, completedCourses, profile]);

  const completion = useMemo(() => {
    if (!programId || completedCourses.length === 0) return null;
    try {
      return computeCompletion(completedCourses, programId);
    } catch {
      return null;
    }
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
