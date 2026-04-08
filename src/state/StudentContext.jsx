import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import programs from "../data/programs.json" with { type: "json" };
import { computeCompletion } from "../utils/degreeEngine.js";
import { getStudent, setStudent as persistStudent, clearAll } from "../utils/storage.js";

/**
 * StudentContext.jsx — program, courses, profile, optional planByTerm (dashboard),
 * memoized completion.
 */

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  const [programId, setProgramId] = useState(() => getStudent()?.programId ?? null);
  const [completedCourses, setCompletedCourses] = useState(
    () => getStudent()?.completedCourses ?? []
  );
  const [profile, setProfile] = useState(() => getStudent()?.profile ?? null);
  const [planByTerm, setPlanByTerm] = useState(() => getStudent()?.planByTerm ?? {});

  useEffect(() => {
    if (programId && !programs[programId]) {
      clearAll();
      setProgramId(null);
      setCompletedCourses([]);
      setProfile(null);
      setPlanByTerm({});
    }
  }, [programId]);

  useEffect(() => {
    if (programId && completedCourses.length > 0) {
      persistStudent({ programId, completedCourses, profile, planByTerm });
    }
  }, [programId, completedCourses, profile, planByTerm]);

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
    setPlanByTerm({});
  }, []);

  const value = {
    programId,
    completedCourses,
    profile,
    planByTerm,
    completion,
    setProgramId,
    setCompletedCourses,
    setProfile,
    setPlanByTerm,
    reset,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside <StudentProvider>");
  return ctx;
}
