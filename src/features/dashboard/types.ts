export type SystemId = "proxmox" | "unraid";

export type Availability = "up" | "down" | "unknown";

export type TimeSeriesPoint = [timestamp: number, value: number];

export interface CpuMetric {
  percent: number;
  cores: number;
  threads: number;
  history: TimeSeriesPoint[];
}

export interface MemoryMetric {
  percent: number;
  usedBytes: number;
  totalBytes: number;
  history: TimeSeriesPoint[];
}

export interface NetworkMetric {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
  totalRxBytes: number;
  totalTxBytes: number;
  rxHistory: TimeSeriesPoint[];
  txHistory: TimeSeriesPoint[];
}

export interface CoreSystem {
  id: SystemId;
  name: string;
  address: string;
  version: string;
  status: Availability;
  uptimeSeconds: number;
  cpu: CpuMetric;
  memory: MemoryMetric;
  network: NetworkMetric;
}

export type DeviceKind = "vm" | "container" | "host" | "device";

export type DeviceProvider =
  | {
      type: "proxmox";
      id: string;
    }
  | {
      type: "manual";
    };

export interface LanDeviceDefinition {
  id: string;
  name: string;
  address: string;
  url: string;
  kind: DeviceKind;
  provider: DeviceProvider;
  healthUrl?: string;
}

export interface LanDevice extends LanDeviceDefinition {
  status: Availability;
  cpuPercent: number | null;
  memoryPercent: number | null;
  uptimeSeconds: number | null;
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
  glyph: string;
}

export interface DashboardIssue {
  source: SystemId | "devices";
  code: string;
}

export interface DashboardSnapshot {
  mode: "mock" | "live";
  generatedAt: string;
  pollIntervalMs: number;
  networkLinkLabel: string;
  systems: CoreSystem[];
  devices: LanDevice[];
  links: QuickLink[];
  issues: DashboardIssue[];
}

export interface ProxmoxVmSnapshot {
  id: string;
  status: Availability;
  cpuPercent: number;
  memoryPercent: number;
  uptimeSeconds: number;
}

export interface ProviderSnapshot {
  system: CoreSystem;
  virtualMachines?: Map<string, ProxmoxVmSnapshot>;
}
