import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardSnapshot } from "@/features/dashboard/get-dashboard-snapshot";
import {
  ProxmoxConfigurationError,
  getProxmoxSnapshot,
} from "@/features/dashboard/providers/proxmox";
import { getUnraidSnapshot } from "@/features/dashboard/providers/unraid";
import type { CoreSystem } from "@/features/dashboard/types";
import { resetRuntimeEnvironmentForTests } from "@/lib/env";

vi.mock("@/features/dashboard/providers/proxmox", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/dashboard/providers/proxmox")
    >();

  return { ...actual, getProxmoxSnapshot: vi.fn() };
});

vi.mock("@/features/dashboard/providers/unraid", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/dashboard/providers/unraid")
    >();

  return { ...actual, getUnraidSnapshot: vi.fn() };
});

function system(id: CoreSystem["id"]): CoreSystem {
  return {
    id,
    name: id === "proxmox" ? "Proxmox" : "Unraid",
    address: `${id}.local`,
    version: "1.0.0",
    status: "up",
    uptimeSeconds: 3_600,
    cpu: { percent: 10, cores: 4, threads: 8, history: [[1_000, 10]] },
    memory: {
      percent: 25,
      usedBytes: 1_000,
      totalBytes: 4_000,
      history: [[1_000, 25]],
    },
    network: {
      rxBytesPerSecond: 100,
      txBytesPerSecond: 50,
      totalRxBytes: 10_000,
      totalTxBytes: 5_000,
      rxHistory: [[1_000, 100]],
      txHistory: [[1_000, 50]],
    },
  };
}

describe("dashboard snapshot integration", () => {
  beforeEach(() => {
    process.env.DASHBOARD_POLL_INTERVAL_MS = "30000";
    resetRuntimeEnvironmentForTests();
    vi.mocked(getProxmoxSnapshot)
      .mockReset()
      .mockResolvedValue({
        system: system("proxmox"),
        virtualMachines: new Map([
          [
            "101",
            {
              id: "101",
              status: "up",
              cpuPercent: 12,
              memoryPercent: 34,
              uptimeSeconds: 3_600,
            },
          ],
        ]),
      });
    vi.mocked(getUnraidSnapshot)
      .mockReset()
      .mockResolvedValue({ system: system("unraid") });
  });

  it("builds the dashboard contract from provider results", async () => {
    const snapshot = await getDashboardSnapshot(
      new Date("2026-08-27T12:00:00.000Z"),
    );

    expect(snapshot).not.toHaveProperty("mode");
    expect(snapshot.systems.map((system) => system.id)).toEqual([
      "proxmox",
      "unraid",
    ]);
    expect(snapshot.devices).toHaveLength(8);
    expect(snapshot.links).toHaveLength(10);
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.devices[0]).toMatchObject({
      status: "up",
      cpuPercent: 12,
      memoryPercent: 34,
    });
  });

  it("does not represent unavailable provider telemetry as zero", async () => {
    vi.mocked(getProxmoxSnapshot).mockRejectedValue(
      new ProxmoxConfigurationError(),
    );

    const snapshot = await getDashboardSnapshot();
    const proxmox = snapshot.systems.find((system) => system.id === "proxmox");

    expect(proxmox).toMatchObject({
      status: "down",
      uptimeSeconds: null,
      cpu: { percent: null, cores: null, threads: null, history: [] },
      memory: { percent: null, usedBytes: null, totalBytes: null, history: [] },
      network: {
        rxBytesPerSecond: null,
        txBytesPerSecond: null,
        totalRxBytes: null,
        totalTxBytes: null,
        rxHistory: [],
        txHistory: [],
      },
    });
    expect(snapshot.issues).toContainEqual({
      source: "proxmox",
      code: "configuration",
    });
  });
});
