import "server-only";

import { dashboardCatalog } from "@/config/dashboard";
import {
  ProxmoxConfigurationError,
  getProxmoxSnapshot,
} from "@/features/dashboard/providers/proxmox";
import {
  UnraidConfigurationError,
  getUnraidSnapshot,
} from "@/features/dashboard/providers/unraid";
import {
  UniFiConfigurationError,
  getUniFiSnapshot,
} from "@/features/dashboard/providers/unifi";
import type {
  CoreSystem,
  DashboardIssue,
  DashboardSnapshot,
  LanDevice,
  LanDeviceDefinition,
  ProxmoxVmSnapshot,
  SystemId,
  UniFiNetwork,
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
    uptimeSeconds: null,
    cpu: { percent: null, cores: null, threads: null, history: [] },
    memory: {
      percent: null,
      usedBytes: null,
      totalBytes: null,
      history: [],
    },
    network: {
      rxBytesPerSecond: null,
      txBytesPerSecond: null,
      totalRxBytes: null,
      totalTxBytes: null,
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

function unavailableUniFi(address: string): UniFiNetwork {
  return {
    name: "UniFi",
    address,
    model: "Gateway",
    firmwareVersion: "—",
    applicationVersion: "—",
    status: "down",
    uptimeSeconds: null,
    cpuPercent: null,
    memoryPercent: null,
    loadAverage1Min: null,
    internetIssueCount: 0,
    traffic: {
      rxBytesPerSecond: null,
      txBytesPerSecond: null,
      rxHistory: [],
      txHistory: [],
    },
    internet: {
      ispName: null,
      ispAsn: null,
      averageLatencyMs: null,
      maximumLatencyMs: null,
      packetLossPercent: null,
      uptimePercent: null,
      downtimeSeconds: null,
      downloadKbps: null,
      uploadKbps: null,
      latencyHistory: [],
      maximumLatencyHistory: [],
      packetLossHistory: [],
    },
    clients: {
      total: null,
      wired: null,
      wireless: null,
      guest: null,
      vpn: null,
      history: [],
    },
    devices: {
      online: null,
      total: null,
      pendingUpdates: null,
      portsUp: null,
      portsTotal: null,
      wanCount: null,
    },
  };
}

function issueForUniFiError(error: unknown): DashboardIssue {
  return {
    source: "unifi",
    code:
      error instanceof UniFiConfigurationError
        ? "configuration"
        : "unavailable",
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

  const [proxmoxResult, unraidResult, unifiResult] = await Promise.allSettled([
    getProxmoxSnapshot(environment),
    getUnraidSnapshot(environment, now.getTime()),
    getUniFiSnapshot(environment, now.getTime()),
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

  const unifi =
    unifiResult.status === "fulfilled"
      ? unifiResult.value.network
      : unavailableUniFi(hostnameFromUrl(environment.UNIFI_API_URL));

  if (unifiResult.status === "fulfilled") {
    issues.push(...unifiResult.value.issues);
  } else {
    issues.push(issueForUniFiError(unifiResult.reason));
  }

  const devices = await Promise.all(
    dashboardCatalog.devices.map((device) =>
      resolveDevice(device, virtualMachines, environment.PROVIDER_TIMEOUT_MS),
    ),
  );

  return {
    generatedAt: now.toISOString(),
    pollIntervalMs: environment.DASHBOARD_POLL_INTERVAL_MS,
    networkLinkLabel: dashboardCatalog.networkLinkLabel,
    systems: [proxmoxSystem, unraidSystem],
    unifi,
    devices,
    links: [...dashboardCatalog.links],
    issues,
  };
}
