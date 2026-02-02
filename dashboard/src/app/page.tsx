import { Suspense } from 'react';
import { DashboardContent } from './dashboard-content';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-48 bg-zinc-800 rounded-lg" />

      {/* Stats skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-zinc-800 rounded-xl" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[400px] bg-zinc-800 rounded-xl" />
        <div className="h-[400px] bg-zinc-800 rounded-xl" />
      </div>
    </div>
  );
}
