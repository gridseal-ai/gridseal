import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-500 mb-6">Page not found.</p>
      <Link
        to="/"
        className="text-seal-600 hover:text-seal-800 font-medium transition-colors"
      >
        Back to chains
      </Link>
    </div>
  );
}
