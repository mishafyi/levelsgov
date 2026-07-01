"use client";

import dynamic from "next/dynamic";

const USPayMap = dynamic(
  () => import("@/components/us-pay-map").then((m) => m.USPayMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: "800/500" }}>
        Loading map...
      </div>
    ),
  }
);

const USStateImpactMap = dynamic(
  () => import("@/components/us-pay-map").then((m) => m.USStateImpactMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: "800/500" }}>
        Loading map...
      </div>
    ),
  }
);

export { USPayMap as USPayMapLazy, USStateImpactMap as USStateImpactMapLazy };
