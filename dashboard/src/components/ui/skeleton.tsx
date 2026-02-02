import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-800', className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <Skeleton className="h-5 w-32 mb-6" />
      <div className="h-[300px] flex items-end gap-2">
        {[...Array(12)].map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-zinc-800">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function ExpenseListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <Skeleton className="h-5 w-40 mb-6" />
      {[...Array(rows)].map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Recent expenses */}
      <ExpenseListSkeleton />
    </div>
  );
}

export { Skeleton };
