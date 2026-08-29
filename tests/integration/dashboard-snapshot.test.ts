import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardSnapshot } from "@/features/dashboard/get-dashboard-snapshot";
import {
  HostCatalogConfigurationError,
  loadHostCatalog,
} from "@/features/dashboard/host-catalog";
import {
  K3sConfigurationError,
  getK3sSnapshot,
} from "@/features/dashboard/providers/k3s";
import {
  ProxmoxConfigurationError,
  getProxmoxSnapshot,
} from "@/features/dashboard/providers/proxmox";
import { getUnraidSnapshot } from "@/features/dashboard/providers/unraid";
import { getUniFiSnapshot } from "@/features/dashboard/providers/unifi";
import type {
  CoreSystem,
  K3sCluster,
  UniFiNetwork,
} from "@/features/dashboard/types";
import { resetRuntimeEnvironmentForTests } from "@/lib/env";
import { requestIcmpReachability } from "@/lib/icmp";
import { requestTcpReachability } from "@/lib/tcp";

vi.mock("@/features/dashboard/host-catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/dashboard/host-catalog")>();

  return { ...actual, loadHostCatalog: vi.fn() };
});

vi.mock("@/features/dashboard/providers/proxmox", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/dashboard/providers/proxmox")
    >();

  return { ...actual, getProxmoxSnapshot: vi.fn() };
});

vi.mock("@/features/dashboard/providers/k3s", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/dashboard/providers/k3s")>();

  return { ...actual, getK3sSnapshot: vi.fn() };
});

vi.mock("@/features/dashboard/providers/unraid", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/dashboard/providers/unraid")
    >();

  return { ...actual, getUnraidSnapshot: vi.fn() };
});

vi.mock("@/features/dashboard/providers/unifi", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/dashboard/providers/unifi")
    >();

  return { ...actual, getUniFiSnapshot: vi.fn() };
});

vi.mock("@/lib/tcp", () => ({ requestTcpReachability: vi.fn() }));
vi.mock("@/lib/icmp", () => ({ requestIcmpReachability: vi.fn() }));

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

function unifiNetwork(): UniFiNetwork {
  return {
    name: "UniFi",
    address: "gateway.local",
    model: "UCG Ultra",
    firmwareVersion: "5.1.31",
    applicationVersion: "10.5.67",
    status: "up",
    uptimeSeconds: 3_600,
    cpuPercent: 12,
    memoryPercent: 34,
    loadAverage1Min: 0.8,
    internetIssueCount: 0,
    traffic: {
      rxBytesPerSecond: 100,
      txBytesPerSecond: 50,
      rxHistory: [[1_000, 100]],
      txHistory: [[1_000, 50]],
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
      latencyHistory: [[1_000, 5]],
      maximumLatencyHistory: [[1_000, 10]],
      packetLossHistory: [[1_000, 0]],
    },
    clients: {
      total: 19,
      wired: 10,
      wireless: 9,
      guest: 0,
      vpn: 0,
      history: [[1_000, 19]],
    },
    devices: {
      online: 5,
      total: 5,
      pendingUpdates: 0,
      portsUp: 4,
      portsTotal: 5,
      wanCount: 2,
    },
  };
}

function k3sCluster(): K3sCluster {
  return {
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
        memoryPercent: 25,
        memoryUsedBytes: 2_000,
        memoryAllocatableBytes: 8_000,
        podCount: 4,
        cpuHistory: [[1_000, 10]],
        memoryHistory: [[1_000, 25]],
        podHistory: [[1_000, 4]],
      },
    ],
  };
}

describe("dashboard snapshot integration", () => {
  beforeEach(() => {
    process.env.DASHBOARD_POLL_INTERVAL_MS = "30000";
    process.env.HOSTS_CONFIG_PATH = "config/hosts.json";
    process.env.K3S_CONFIG_PATH = "k3s.config";
    resetRuntimeEnvironmentForTests();
    vi.mocked(loadHostCatalog).mockReset().mockResolvedValue([]);
    vi.mocked(requestIcmpReachability).mockReset().mockResolvedValue(true);
    vi.mocked(requestTcpReachability).mockReset().mockResolvedValue(true);
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
    vi.mocked(getUniFiSnapshot)
      .mockReset()
      .mockResolvedValue({ network: unifiNetwork(), issues: [] });
    vi.mocked(getK3sSnapshot).mockReset().mockResolvedValue(k3sCluster());
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
    expect(snapshot.devices).toHaveLength(0);
    expect(snapshot.links).toHaveLength(0);
    expect(snapshot.unifi).toMatchObject({
      model: "UCG Ultra",
      clients: { total: 19 },
      devices: { online: 5, total: 5 },
    });
    expect(snapshot.k3s).toMatchObject({
      status: "up",
      nodesReady: 1,
      podsTotal: 4,
    });
    expect(snapshot.issues).toEqual([]);
  });

  it("degrades missing K3s configuration without fabricating node metrics", async () => {
    vi.mocked(getK3sSnapshot).mockRejectedValue(new K3sConfigurationError());

    const snapshot = await getDashboardSnapshot();

    expect(snapshot.k3s).toEqual({
      name: "K3s",
      address: "—",
      version: "—",
      status: "down",
      nodesReady: 0,
      nodesTotal: 0,
      podsTotal: 0,
      nodes: [],
    });
    expect(snapshot.issues).toContainEqual({
      source: "k3s",
      code: "configuration",
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

  it("appends configured hosts and reports TCP and ICMP status", async () => {
    vi.mocked(loadHostCatalog).mockResolvedValue([
      {
        id: "open-service",
        name: "Open service",
        address: "open.local:443",
        url: "https://open.local",
        kind: "host",
        provider: { type: "tcp", host: "open.local", port: 443 },
      },
      {
        id: "closed-service",
        name: "Closed service",
        address: "closed.local:22",
        kind: "host",
        provider: { type: "tcp", host: "closed.local", port: 22 },
      },
      {
        id: "backup-server",
        name: "Backup server",
        address: "backup.local",
        kind: "host",
        provider: { type: "icmp", host: "backup.local" },
      },
    ]);
    vi.mocked(requestTcpReachability).mockImplementation(async (host) =>
      host.startsWith("open"),
    );
    vi.mocked(requestIcmpReachability).mockResolvedValue(true);

    const snapshot = await getDashboardSnapshot();

    expect(snapshot.devices).toHaveLength(3);
    expect(snapshot.devices).toMatchObject([
      {
        id: "open-service",
        status: "up",
        cpuPercent: null,
        memoryPercent: null,
        uptimeSeconds: null,
      },
      {
        id: "closed-service",
        status: "down",
        cpuPercent: null,
        memoryPercent: null,
        uptimeSeconds: null,
      },
      {
        id: "backup-server",
        status: "up",
        cpuPercent: null,
        memoryPercent: null,
        uptimeSeconds: null,
      },
    ]);
    expect(requestTcpReachability).toHaveBeenCalledTimes(2);
    expect(requestIcmpReachability).toHaveBeenCalledWith("backup.local", 8_000);
  });

  it("degrades invalid host catalogs without affecting core providers", async () => {
    vi.mocked(loadHostCatalog).mockRejectedValue(
      new HostCatalogConfigurationError("Invalid catalog"),
    );

    const snapshot = await getDashboardSnapshot();

    expect(snapshot.devices).toHaveLength(0);
    expect(snapshot.issues).toContainEqual({
      source: "devices",
      code: "configuration",
    });
  });
});
