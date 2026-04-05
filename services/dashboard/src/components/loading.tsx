export function Loading({ label = "Loading..." }: { readonly label?: string }) {
  return (
    <div className="flex items-center justify-center py-12" data-testid="loading">
      <div className="flex items-center gap-3 text-gray-500">
        <div className="h-5 w-5 border-2 border-seal-300 border-t-seal-600 rounded-full animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
