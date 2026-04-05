import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type NavItem = {
  readonly label: string;
  readonly path: string;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Chains", path: "/" },
] as const;

export function Layout({ children }: { readonly children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-seal-950 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight">
                GridSeal
              </span>
              <span className="text-seal-300 text-sm font-medium">
                Audit Dashboard
              </span>
            </Link>
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-seal-800 text-white"
                      : "text-seal-300 hover:bg-seal-900 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          GridSeal by Celestir
        </div>
      </footer>
    </div>
  );
}
