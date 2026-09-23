// The mark is a "P" sliced into print layers; public/logo.svg is the same
// drawing for favicons and search results.
export function Logo({ className = "" }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <img src="/logo.svg" alt="" width="36" height="36" className="h-9 w-9" />
      <span className="font-display text-lg font-bold tracking-tight">
        Print<span className="text-flame">Yours</span>
      </span>
    </span>
  );
}
