import { Navigate, useLocation } from "react-router-dom";
import { useStudent } from "../../state/StudentContext.jsx";

/**
 * Route guard for /dashboard.
 *
 * If there's no student data yet (first-time visitor or post-reset), kick
 * the user to /setup. Otherwise render the children. Lives outside the
 * page itself so the page can assume `completion` is non-null.
 */
export function RequireSetup({ children }) {
  const { completedCourses } = useStudent();
  const location = useLocation();
  if (!completedCourses || completedCourses.length === 0) {
    return <Navigate to="/setup" replace state={{ from: location }} />;
  }
  return children;
}
