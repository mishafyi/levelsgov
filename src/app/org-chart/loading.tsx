import { Skeleton } from "@/components/ui/skeleton";

export default function OrgChartLoading() {
  return (
    <div className="mx-auto px-4 py-8 sm:px-6" style={{ maxWidth: "80rem" }}>
      <div className="flex justify-center">
        <div className="w-full text-center" style={{ maxWidth: 380 }}>
          <Skeleton className="mx-auto mb-2 h-6 w-32" />
          <Skeleton className="mx-auto mb-2 h-8 w-48" />
          <Skeleton className="mx-auto h-10 w-36" />
        </div>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
