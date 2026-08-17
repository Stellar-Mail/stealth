import { Skeleton } from "@/components/ui/skeleton";

export function ContactNotesLoadingState() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading contact notes">
      <div className="text-sm text-slate-600">Loading notes...</div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200"
        >
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2 mt-1">
            <Skeleton className="h-6 w-16 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
