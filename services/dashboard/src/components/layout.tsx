import { NavLink, Outlet } from "react-router";

const NAV_ITEMS = [
  { to: "/chains", label: "Audit Trail" },
  { to: "/verify", label: "Verification" },
] as const;

function navClass({ isActive }: { isActive: boolean }): string {
  const base = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  return isActive
    ? `${base} bg-sky-900/50 text-sky-300`
    : `${base} text-slate-400 hover:text-slate-200 hover:bg-slate-800`;
}

export function Layout(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="text-lg font-semibold text-slate-100 tracking-tight">
                GridSeal
              </NavLink>
              <nav className="flex gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navClass}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
