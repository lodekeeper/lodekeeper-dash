export function CardSkeleton() {
  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4 animate-pulse">
      <div className="h-4 bg-surface-3 rounded w-24 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-surface-3 rounded w-full" />
        <div className="h-3 bg-surface-3 rounded w-3/4" />
        <div className="h-3 bg-surface-3 rounded w-1/2" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-surface-1 rounded-lg border border-surface-3 p-4 animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-3 bg-surface-3 rounded w-16" />
          <div className="h-3 bg-surface-3 rounded flex-1" />
          <div className="h-3 bg-surface-3 rounded w-20" />
        </div>
      ))}
    </div>
  );
}
