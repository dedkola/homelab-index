import { beforeEach, describe, expect, it } from "vitest";

import { getDashboardSnapshot } from "@/features/dashboard/get-dashboard-snapshot";
import { resetRuntimeEnvironmentForTests } from "@/lib/env";

describe("dashboard snapshot integration", () => {
  beforeEach(() => {
    process.env.DASHBOARD_MODE = "mock";
    process.env.DASHBOARD_POLL_INTERVAL_MS = "30000";
    resetRuntimeEnvironmentForTests();
  });

  it("returns the complete deterministic dashboard contract in mock mode", async () => {
    const snapshot = await getDashboardSnapshot(
      new Date("2026-08-27T12:00:00.000Z"),
    );

    expect(snapshot.mode).toBe("mock");
    expect(snapshot.systems.map((system) => system.id)).toEqual([
      "proxmox",
      "unraid",
    ]);
    expect(snapshot.devices).toHaveLength(8);
    expect(snapshot.links).toHaveLength(10);
    expect(snapshot.issues).toEqual([]);
    expect(
      snapshot.systems.every((system) => system.cpu.history.length > 2),
    ).toBe(true);
  });
});
