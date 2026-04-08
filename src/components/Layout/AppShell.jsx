import { Link, useLocation } from "react-router-dom";

/**
 * AppShell — top-level chrome shared by every page.
 *
 * Hybrid Healthcare/Fintech layout: thin top bar with the brand mark on the
 * left, program label in the center, and the "Reset" / restart link on the
 * right. The page content fills the area below.
 *
 * Layout grids are wired by the page itself (Setup is single-column;
 * Dashboard splits 70/30 with the chat sidebar).
 */
export function AppShell({ children }) {
  const { pathname } = useLocation();
  const showReset = pathname === "/dashboard";

  return (
    <div className="flex h-full min-h-screen flex-col bg-canvas">
      <header className="border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] max-w-[1400px] items-center justify-between px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-penn text-sm font-bold text-white shadow-md">
              P
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Penn Advisor
            </span>
          </Link>
          {showReset ? (
            <div className="flex items-center gap-2">
              <Link
                to="/setup"
                className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-slate-100 hover:text-slate-900"
              >
                Update setup
              </Link>
              <Link
                to="/setup?reset=1"
                className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-slate-100 hover:text-slate-900"
              >
                Reset
              </Link>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-8">
        {children}
      </main>
    </div>
  );
}
