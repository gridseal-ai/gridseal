import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-4xl font-bold text-celestir-text-secondary">404</h1>
      <p className="mt-2 text-celestir-text-muted">Page not found.</p>
      <Link
        to="/"
        className="mt-6 px-4 py-2 rounded bg-celestir-navy-800 border border-celestir-navy-700 hover:bg-celestir-navy-700 text-sm text-celestir-text-secondary transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
