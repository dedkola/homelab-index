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
    unifi: {
      name: "UniFi",
      address: "gateway.local",
      model: "UCG Ultra",
      firmwareVersion: "5.1.31",
      applicationVersion: "10.5.67",
      status: "up",
      uptimeSeconds: 3_600,
      cpuPercent: 10,
      memoryPercent: 20,
      loadAverage1Min: 0.5,
      internetIssueCount: 0,
      traffic: {
        rxBytesPerSecond: 100,
        txBytesPerSecond: 50,
        rxHistory: [],
        txHistory: [],
      },
      internet: {
        ispName: "ISP",
        ispAsn: "123",
        averageLatencyMs: 5,
        maximumLatencyMs: 10,
        packetLossPercent: 0,
        uptimePercent: 100,
        downtimeSeconds: 0,
        downloadKbps: 1_000_000,
        uploadKbps: 1_000_000,
        latencyHistory: [],
        maximumLatencyHistory: [],
        packetLossHistory: [],
      },
      clients: {
        total: 10,
        wired: 6,
        wireless: 4,
        guest: 0,
        vpn: 0,
        history: [],
      },
      devices: {
        online: 5,
        total: 5,
        pendingUpdates: 0,
        portsUp: 4,
        portsTotal: 5,
        wanCount: 2,
      },
    },
    k3s: {
      name: "K3s",
      address: "192.168.0.240",
      version: "v1.36.2+k3s1",
      status: "up",
      nodesReady: 1,
      nodesTotal: 1,
      podsTotal: 4,
      nodes: [
        {
          name: "k3s-server",
          address: "192.168.0.240",
          role: "control-plane",
          version: "v1.36.2+k3s1",
          status: "up",
          cpuPercent: 10,
          cpuUsedCores: 0.2,
          cpuAllocatableCores: 2,
          memoryPercent: 20,
          memoryUsedBytes: 2_000,
          memoryAllocatableBytes: 10_000,
          podCount: 4,
          cpuHistory: history,
          memoryHistory: [],
          podHistory: [],
        },
      ],
    },
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
    expect(merged.k3s.nodes[0].cpuHistory.at(-1)).toEqual(nextPoint);
  });
});
