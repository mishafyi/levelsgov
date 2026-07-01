import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton shared by the employment / accessions / separations list pages. */
export function ListPageSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="hidden w-64 shrink-0 border-r md:block">
        <div className="space-y-4 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1 p-4">
        <Skeleton className="mb-2 h-7 w-48" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
