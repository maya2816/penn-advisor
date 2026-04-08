import { Navigate, useLocation } from "react-router-dom";
import { useStudent } from "../../state/StudentContext.jsx";

/**
 * Route guard for /dashboard.
 *
 * Requires both a programId and at least one completed course so
 * `computeCompletion()` always has valid inputs (avoids a blank page when
 * localStorage was corrupted or hand-edited).
 */
export function RequireSetup({ children }) {
  const { programId, completedCourses } = useStudent();
  const location = useLocation();
  const hasCourses = completedCourses && completedCourses.length > 0;
  if (!programId || !hasCourses) {
    return <Navigate to="/setup" replace state={{ from: location }} />;
  }
  return children;
}
