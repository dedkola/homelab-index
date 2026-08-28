export type SystemId = "proxmox" | "unraid";

export type Availability = "up" | "down" | "unknown";

export type TimeSeriesPoint = [timestamp: number, value: number];

export interface CpuMetric {
  percent: number | null;
  cores: number | null;
  threads: number | null;
  history: TimeSeriesPoint[];
}

export interface MemoryMetric {
  percent: number | null;
  usedBytes: number | null;
  totalBytes: number | null;
  history: TimeSeriesPoint[];
}

export interface NetworkMetric {
  rxBytesPerSecond: number | null;
  txBytesPerSecond: number | null;
  totalRxBytes: number | null;
  totalTxBytes: number | null;
  rxHistory: TimeSeriesPoint[];
  txHistory: TimeSeriesPoint[];
}

export interface CoreSystem {
  id: SystemId;
  name: string;
  address: string;
  version: string;
  status: Availability;
  uptimeSeconds: number | null;
  cpu: CpuMetric;
  memory: MemoryMetric;
  network: NetworkMetric;
}

export interface UniFiTrafficMetric {
  rxBytesPerSecond: number | null;
  txBytesPerSecond: number | null;
  rxHistory: TimeSeriesPoint[];
  txHistory: TimeSeriesPoint[];
}

export interface UniFiInternetMetric {
  ispName: string | null;
  ispAsn: string | null;
  averageLatencyMs: number | null;
  maximumLatencyMs: number | null;
  packetLossPercent: number | null;
  uptimePercent: number | null;
  downtimeSeconds: number | null;
  downloadKbps: number | null;
  uploadKbps: number | null;
  latencyHistory: TimeSeriesPoint[];
  maximumLatencyHistory: TimeSeriesPoint[];
  packetLossHistory: TimeSeriesPoint[];
}

export interface UniFiClientMetric {
  total: number | null;
  wired: number | null;
  wireless: number | null;
  guest: number | null;
  vpn: number | null;
  history: TimeSeriesPoint[];
}

export interface UniFiDeviceMetric {
  online: number | null;
  total: number | null;
  pendingUpdates: number | null;
  portsUp: number | null;
  portsTotal: number | null;
  wanCount: number | null;
}

export interface UniFiNetwork {
  name: string;
  address: string;
  model: string;
  firmwareVersion: string;
  applicationVersion: string;
  status: Availability;
  uptimeSeconds: number | null;
  cpuPercent: number | null;
  memoryPercent: number | null;
  loadAverage1Min: number | null;
  internetIssueCount: number;
  traffic: UniFiTrafficMetric;
  internet: UniFiInternetMetric;
  clients: UniFiClientMetric;
  devices: UniFiDeviceMetric;
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
  source: SystemId | "unifi" | "devices";
  code: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  pollIntervalMs: number;
  networkLinkLabel: string;
  systems: CoreSystem[];
  unifi: UniFiNetwork;
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
