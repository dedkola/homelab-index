import "server-only";

import { dashboardCatalog } from "@/config/dashboard";
import { getMockDashboardSnapshot } from "@/features/dashboard/mock";
import {
  ProxmoxConfigurationError,
  getProxmoxSnapshot,
} from "@/features/dashboard/providers/proxmox";
import {
  UnraidConfigurationError,
  getUnraidSnapshot,
} from "@/features/dashboard/providers/unraid";
import type {
  CoreSystem,
  DashboardIssue,
  DashboardSnapshot,
  LanDevice,
  LanDeviceDefinition,
  ProxmoxVmSnapshot,
  SystemId,
} from "@/features/dashboard/types";
import { getRuntimeEnvironment } from "@/lib/env";
import { requestReachability } from "@/lib/http";

function hostnameFromUrl(value: string | undefined): string {
  if (!value) {
    return "—";
  }

  try {
    return new URL(value).hostname;
  } catch {
    return "—";
  }
}

function unavailableSystem(id: SystemId, address: string): CoreSystem {
  return {
    id,
    name: id === "proxmox" ? "Proxmox" : "Unraid",
    address,
    version: "—",
    status: "down",
    uptimeSeconds: 0,
    cpu: { percent: 0, cores: 0, threads: 0, history: [] },
    memory: { percent: 0, usedBytes: 0, totalBytes: 0, history: [] },
    network: {
      rxBytesPerSecond: 0,
      txBytesPerSecond: 0,
      totalRxBytes: 0,
      totalTxBytes: 0,
      rxHistory: [],
      txHistory: [],
    },
  };
}

function issueForError(source: SystemId, error: unknown): DashboardIssue {
  const isConfigurationError =
    error instanceof ProxmoxConfigurationError ||
    error instanceof UnraidConfigurationError;

  return {
    source,
    code: isConfigurationError ? "configuration" : "unavailable",
  };
}

async function resolveDevice(
  definition: LanDeviceDefinition,
  virtualMachines: Map<string, ProxmoxVmSnapshot>,
  timeoutMs: number,
): Promise<LanDevice> {
  if (definition.provider.type === "proxmox") {
    const virtualMachine = virtualMachines.get(definition.provider.id);

    return {
      ...definition,
      status: virtualMachine?.status ?? "unknown",
      cpuPercent: virtualMachine?.cpuPercent ?? null,
      memoryPercent: virtualMachine?.memoryPercent ?? null,
      uptimeSeconds: virtualMachine?.uptimeSeconds ?? null,
    };
  }

  const reachable = definition.healthUrl
    ? await requestReachability(definition.healthUrl, timeoutMs)
    : null;

  return {
    ...definition,
    status: reachable === null ? "unknown" : reachable ? "up" : "down",
    cpuPercent: null,
    memoryPercent: null,
    uptimeSeconds: null,
  };
}

export async function getDashboardSnapshot(
  now = new Date(),
): Promise<DashboardSnapshot> {
  const environment = getRuntimeEnvironment();

  if (environment.DASHBOARD_MODE === "mock") {
    return getMockDashboardSnapshot(now);
  }

  const [proxmoxResult, unraidResult] = await Promise.allSettled([
    getProxmoxSnapshot(environment),
    getUnraidSnapshot(environment, now.getTime()),
  ]);
  const issues: DashboardIssue[] = [];
  const virtualMachines =
    proxmoxResult.status === "fulfilled"
      ? (proxmoxResult.value.virtualMachines ??
        new Map<string, ProxmoxVmSnapshot>())
      : new Map<string, ProxmoxVmSnapshot>();

  const proxmoxSystem =
    proxmoxResult.status === "fulfilled"
      ? proxmoxResult.value.system
      : unavailableSystem(
          "proxmox",
          hostnameFromUrl(environment.PROXMOX_API_URL),
        );
  const unraidSystem =
    unraidResult.status === "fulfilled"
      ? unraidResult.value.system
      : unavailableSystem(
          "unraid",
          hostnameFromUrl(environment.UNRAID_GRAPHQL_URL),
        );

  if (proxmoxResult.status === "rejected") {
    issues.push(issueForError("proxmox", proxmoxResult.reason));
  }

  if (unraidResult.status === "rejected") {
    issues.push(issueForError("unraid", unraidResult.reason));
  }

  const devices = await Promise.all(
    dashboardCatalog.devices.map((device) =>
      resolveDevice(device, virtualMachines, environment.PROVIDER_TIMEOUT_MS),
    ),
  );

  return {
    mode: "live",
    generatedAt: now.toISOString(),
    pollIntervalMs: environment.DASHBOARD_POLL_INTERVAL_MS,
    networkLinkLabel: dashboardCatalog.networkLinkLabel,
    systems: [proxmoxSystem, unraidSystem],
    devices,
    links: [...dashboardCatalog.links],
    issues,
  };
}
