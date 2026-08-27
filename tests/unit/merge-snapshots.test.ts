import { describe, expect, it } from "vitest";

import { mergeDashboardSnapshots } from "@/features/dashboard/merge-snapshots";
import type {
  DashboardSnapshot,
  TimeSeriesPoint,
} from "@/features/dashboard/types";

function snapshotWithCpuHistory(history: TimeSeriesPoint[]): DashboardSnapshot {
  return {
    generatedAt: "2026-08-27T12:00:00.000Z",
    pollIntervalMs: 30_000,
    networkLinkLabel: "2.5G",
    systems: [
      {
        id: "unraid",
        name: "Unraid",
        address: "unraid.local",
        version: "7.2.0",
        status: "up",
        uptimeSeconds: 3_600,
        cpu: { percent: 20, cores: 4, threads: 8, history },
        memory: {
          percent: 30,
          usedBytes: 3_000,
          totalBytes: 10_000,
          history: [],
        },
        network: {
          rxBytesPerSecond: 100,
          txBytesPerSecond: 50,
          totalRxBytes: 10_000,
          totalTxBytes: 5_000,
          rxHistory: [],
          txHistory: [],
        },
      },
    ],
    devices: [],
    links: [],
    issues: [],
  };
}

describe("dashboard snapshot history", () => {
  it("preserves full provider history", () => {
    const previous = snapshotWithCpuHistory([[1_000, 10]]);
    const incoming = snapshotWithCpuHistory([
      [1_000, 11],
      [2_000, 12],
    ]);
    const merged = mergeDashboardSnapshots(previous, incoming);

    expect(merged.systems[0].cpu.history).toEqual(
      incoming.systems[0].cpu.history,
    );
  });

  it("appends a single live point to client history", () => {
    const previous = snapshotWithCpuHistory([
      [1_000, 10],
      [2_000, 20],
    ]);
    const nextPoint: [number, number] = [
      Date.parse("2026-08-27T12:00:30.000Z"),
      33,
    ];
    const incoming = snapshotWithCpuHistory([nextPoint]);

    const merged = mergeDashboardSnapshots(previous, incoming);

    expect(merged.systems[0].cpu.history.at(-1)).toEqual(nextPoint);
    expect(merged.systems[0].cpu.history).toHaveLength(
      previous.systems[0].cpu.history.length + 1,
    );
  });
});
