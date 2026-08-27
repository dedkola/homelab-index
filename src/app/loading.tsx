import { LayerCard, SkeletonLine } from "@cloudflare/kumo";

export default function Loading() {
  return (
    <main className="state-page" aria-label="Loading dashboard">
      <LayerCard className="loading-card">
        <SkeletonLine className="h-5 w-44" />
        <SkeletonLine className="h-56 w-full" />
        <SkeletonLine className="h-24 w-full" />
      </LayerCard>
    </main>
  );
}
