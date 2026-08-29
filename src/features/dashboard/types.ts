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

export interface K3sNode {
  name: string;
  address: string;
  role: string;
  version: string;
  status: Availability;
  cpuPercent: number | null;
  cpuUsedCores: number | null;
  cpuAllocatableCores: number;
  memoryPercent: number | null;
  memoryUsedBytes: number | null;
  memoryAllocatableBytes: number;
  podCount: number;
  cpuHistory: TimeSeriesPoint[];
  memoryHistory: TimeSeriesPoint[];
  podHistory: TimeSeriesPoint[];
}

export interface K3sCluster {
  name: string;
  address: string;
  version: string;
  status: Availability;
  nodesReady: number;
  nodesTotal: number;
  podsTotal: number;
  nodes: K3sNode[];
}

export type DeviceKind = "vm" | "container" | "host" | "device";

export type DeviceProvider =
  | {
      type: "proxmox";
      id: string;
    }
  | {
      type: "tcp";
      host: string;
      port: number;
    }
  | {
      type: "icmp";
      host: string;
    };

export interface LanDeviceDefinition {
  id: string;
  name: string;
  address: string;
  url?: string;
  kind: DeviceKind;
  provider: DeviceProvider;
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
}

export interface DashboardIssue {
  source: SystemId | "unifi" | "k3s" | "devices";
  code: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  pollIntervalMs: number;
  systems: CoreSystem[];
  unifi: UniFiNetwork;
  k3s: K3sCluster;
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
