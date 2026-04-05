import { Link } from "react-router";

export function NotFoundPage(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-4xl font-bold text-slate-300">404</h1>
      <p className="mt-2 text-slate-500">Page not found.</p>
      <Link
        to="/"
        className="mt-6 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
