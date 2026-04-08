import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { StudentProvider } from "./state/StudentContext.jsx";
import { RequireSetup } from "./components/Layout/RequireSetup.jsx";
import { SetupPage } from "./pages/SetupPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";

/**
 * App — top-level component. Wraps everything in the StudentProvider so
 * any page can read student state, and defines the two MVP routes.
 *
 * Routing rules:
 *   /          → redirect to /dashboard (then RequireSetup may bounce to /setup)
 *   /setup     → always accessible (entry point + reset target)
 *   /dashboard → guarded by RequireSetup; bounces to /setup if no student data
 *   *          → redirect to /dashboard
 */
export default function App() {
  return (
    <StudentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireSetup>
                <DashboardPage />
              </RequireSetup>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </StudentProvider>
  );
}
