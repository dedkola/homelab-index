import { beforeEach, describe, expect, it } from "vitest";

import { getMockDashboardSnapshot } from "@/features/dashboard/mock";
import { mergeDashboardSnapshots } from "@/features/dashboard/merge-snapshots";
import { resetRuntimeEnvironmentForTests } from "@/lib/env";

describe("dashboard snapshot history", () => {
  beforeEach(() => {
    process.env.DASHBOARD_MODE = "mock";
    resetRuntimeEnvironmentForTests();
  });

  it("preserves full provider history", () => {
    const previous = getMockDashboardSnapshot(
      new Date("2026-08-27T12:00:00.000Z"),
    );
    const incoming = getMockDashboardSnapshot(
      new Date("2026-08-27T12:00:30.000Z"),
    );
    const merged = mergeDashboardSnapshots(previous, incoming);

    expect(merged.systems[0].cpu.history).toEqual(
      incoming.systems[0].cpu.history,
    );
  });

  it("appends a single live point to client history", () => {
    const previous = getMockDashboardSnapshot(
      new Date("2026-08-27T12:00:00.000Z"),
    );
    const incoming = structuredClone(previous);
    const nextPoint: [number, number] = [
      Date.parse("2026-08-27T12:00:30.000Z"),
      33,
    ];

    incoming.systems[1].cpu.history = [nextPoint];
    const merged = mergeDashboardSnapshots(previous, incoming);

    expect(merged.systems[1].cpu.history.at(-1)).toEqual(nextPoint);
    expect(merged.systems[1].cpu.history).toHaveLength(
      previous.systems[1].cpu.history.length + 1,
    );
  });
});
