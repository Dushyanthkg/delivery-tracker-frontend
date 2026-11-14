export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
