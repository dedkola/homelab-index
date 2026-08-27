import { getDashboardSnapshot } from "@/features/dashboard/get-dashboard-snapshot";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snapshot = await getDashboardSnapshot();

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
