import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 flex gap-4 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-4 flex gap-4 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-lg border border-border p-5 space-y-3">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}
