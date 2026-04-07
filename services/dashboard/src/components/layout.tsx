import { Outlet, Link, useLocation } from "react-router";

const NAV_ITEMS = [
  { to: "/chains", label: "Audit Trail" },
  { to: "/verify", label: "Verification" },
] as const;

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-celestir-navy-700/30 bg-celestir-navy-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="4" stroke="#1B6B9A" strokeWidth="1.5" fill="none" />
              <rect x="6" y="6" width="5" height="5" rx="1" fill="#4DA8DA" opacity="0.9" />
              <rect x="13" y="6" width="5" height="5" rx="1" fill="#1B6B9A" opacity="0.6" />
              <rect x="6" y="13" width="5" height="5" rx="1" fill="#1B6B9A" opacity="0.6" />
              <rect x="13" y="13" width="5" height="5" rx="1" fill="#2ECC71" opacity="0.7" />
            </svg>
            <span className="text-base font-semibold tracking-tight text-celestir-text group-hover:text-celestir-stardust transition-colors">
              GridSeal
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 ${
                    active
                      ? "text-celestir-stardust bg-celestir-aurora/10 shadow-[inset_0_-2px_0_0_rgba(77,168,218,0.5)]"
                      : "text-celestir-text-muted hover:text-celestir-text-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-celestir-navy-800/30 py-4">
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wide text-celestir-text-muted/60 uppercase">
            GridSeal
          </span>
          <span className="text-[11px] font-mono text-celestir-text-muted/40">
            tamper-evident audit trail
          </span>
        </div>
      </footer>
    </div>
  );
}
