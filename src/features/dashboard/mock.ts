import { dashboardCatalog } from "@/config/dashboard";
import type {
  CoreSystem,
  DashboardSnapshot,
  LanDevice,
  TimeSeriesPoint,
} from "@/features/dashboard/types";
import { getRuntimeEnvironment } from "@/lib/env";

interface MockSystemSeed {
  id: CoreSystem["id"];
  name: string;
  address: string;
  version: string;
  uptimeSeconds: number;
  cpuPercent: number;
  cpuCores: number;
  cpuThreads: number;
  memoryPercent: number;
  memoryTotalBytes: number;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
  totalRxBytes: number;
  totalTxBytes: number;
  phase: number;
}

const MOCK_SYSTEMS: MockSystemSeed[] = [
  {
    id: "proxmox",
    name: "Proxmox",
    address: "192.168.10.10",
    version: "PVE 9.1.1",
    uptimeSeconds: 1_242_120,
    cpuPercent: 18.4,
    cpuCores: 16,
    cpuThreads: 32,
    memoryPercent: 42,
    memoryTotalBytes: 128_000_000_000,
    rxBytesPerSecond: 145_000_000,
    txBytesPerSecond: 85_000_000,
    totalRxBytes: 8_100_000_000_000,
    totalTxBytes: 4_300_000_000_000,
    phase: 0.25,
  },
  {
    id: "unraid",
    name: "Unraid",
    address: "192.168.10.11",
    version: "7.2.0",
    uptimeSeconds: 753_960,
    cpuPercent: 27.1,
    cpuCores: 12,
    cpuThreads: 24,
    memoryPercent: 61.2,
    memoryTotalBytes: 64_000_000_000,
    rxBytesPerSecond: 76_000_000,
    txBytesPerSecond: 40_000_000,
    totalRxBytes: 21_400_000_000_000,
    totalTxBytes: 10_300_000_000_000,
    phase: 1.4,
  },
];

const DEVICE_METRICS = [
  [18, 42, 558_000],
  [31, 55, 558_000],
  [22, 48, 554_400],
  [8, 19, 1_569_600],
  [15, 63, 1_569_600],
  [12, 37, 1_566_000],
  [17, 52, 2_404_800],
  [3, 14, 2_404_800],
] as const;

function buildWave(
  now: number,
  center: number,
  amplitude: number,
  phase: number,
  minimum = 0,
): TimeSeriesPoint[] {
  return Array.from({ length: 49 }, (_, index) => {
    const time = now - (48 - index) * 30 * 60 * 1_000;
    const primaryWave = Math.sin(index * 0.49 + phase) * amplitude;
    const secondaryWave = Math.sin(index * 1.37 + phase * 2) * amplitude * 0.38;
    const value = Math.max(minimum, center + primaryWave + secondaryWave);

    return [time, Number(value.toFixed(2))];
  });
}

function buildMockSystem(seed: MockSystemSeed, now: number): CoreSystem {
  const memoryUsedBytes = seed.memoryTotalBytes * (seed.memoryPercent / 100);

  return {
    id: seed.id,
    name: seed.name,
    address: seed.address,
    version: seed.version,
    status: "up",
    uptimeSeconds: seed.uptimeSeconds,
    cpu: {
      percent: seed.cpuPercent,
      cores: seed.cpuCores,
      threads: seed.cpuThreads,
      history: buildWave(now, seed.cpuPercent + 7, 11, seed.phase),
    },
    memory: {
      percent: seed.memoryPercent,
      usedBytes: memoryUsedBytes,
      totalBytes: seed.memoryTotalBytes,
      history: buildWave(now, seed.memoryPercent - 2, 4.5, seed.phase + 0.7, 1),
    },
    network: {
      rxBytesPerSecond: seed.rxBytesPerSecond,
      txBytesPerSecond: seed.txBytesPerSecond,
      totalRxBytes: seed.totalRxBytes,
      totalTxBytes: seed.totalTxBytes,
      rxHistory: buildWave(
        now,
        seed.rxBytesPerSecond * 0.8,
        seed.rxBytesPerSecond * 0.35,
        seed.phase + 0.4,
      ),
      txHistory: buildWave(
        now,
        seed.txBytesPerSecond * 0.75,
        seed.txBytesPerSecond * 0.32,
        seed.phase + 1.1,
      ),
    },
  };
}

function buildMockDevices(): LanDevice[] {
  return dashboardCatalog.devices.map((device, index) => {
    const [cpuPercent, memoryPercent, uptimeSeconds] = DEVICE_METRICS[
      index
    ] ?? [0, 0, 0];

    return {
      ...device,
      status: "up",
      cpuPercent,
      memoryPercent,
      uptimeSeconds,
    };
  });
}

export function getMockDashboardSnapshot(now = new Date()): DashboardSnapshot {
  const environment = getRuntimeEnvironment();
  const timestamp = now.getTime();

  return {
    mode: "mock",
    generatedAt: now.toISOString(),
    pollIntervalMs: environment.DASHBOARD_POLL_INTERVAL_MS,
    networkLinkLabel: dashboardCatalog.networkLinkLabel,
    systems: MOCK_SYSTEMS.map((system) => buildMockSystem(system, timestamp)),
    devices: buildMockDevices(),
    links: [...dashboardCatalog.links],
    issues: [],
  };
}
