import "server-only";

import { z } from "zod";

import type {
  CoreSystem,
  ProviderSnapshot,
  ProxmoxVmSnapshot,
  TimeSeriesPoint,
} from "@/features/dashboard/types";
import type { RuntimeEnvironment } from "@/lib/env";
import { clampPercent } from "@/lib/format";
import { requestJson } from "@/lib/http";

const nullableNumber = z.number().nullable().optional();

const nodeStatusSchema = z.object({
  cpu: z.number().optional().default(0),
  uptime: z.number().optional().default(0),
  pveversion: z.string().optional().default("PVE"),
  memory: z
    .object({
      used: z.number().optional().default(0),
      total: z.number().optional().default(0),
    })
    .optional()
    .default({ used: 0, total: 0 }),
  cpuinfo: z
    .object({
      cores: z.number().optional().default(0),
      cpus: z.number().optional().default(0),
    })
    .optional()
    .default({ cores: 0, cpus: 0 }),
});

const rrdPointSchema = z.object({
  time: z.number(),
  cpu: nullableNumber,
  memused: nullableNumber,
  memtotal: nullableNumber,
  netin: nullableNumber,
  netout: nullableNumber,
});

const vmResourceSchema = z.object({
  vmid: z.union([z.string(), z.number()]),
  status: z.string().optional().default("unknown"),
  cpu: z.number().optional().default(0),
  mem: z.number().optional().default(0),
  maxmem: z.number().optional().default(0),
  uptime: z.number().optional().default(0),
});

const apiResponseSchema = z.object({ data: z.unknown() });

export class ProxmoxConfigurationError extends Error {
  constructor() {
    super("Proxmox environment is incomplete");
    this.name = "ProxmoxConfigurationError";
  }
}

function endpoint(
  baseUrl: string,
  path: string,
  searchParams?: Record<string, string>,
): URL {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBaseUrl);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function getProxmoxData<T>(
  url: URL,
  schema: z.ZodType<T>,
  environment: RuntimeEnvironment,
): Promise<T> {
  const payload = await requestJson<unknown>(url, {
    headers: {
      authorization: `PVEAPIToken=${environment.PROXMOX_TOKEN_ID}=${environment.PROXMOX_TOKEN_SECRET}`,
    },
    timeoutMs: environment.PROVIDER_TIMEOUT_MS,
    verifyTls: environment.PROXMOX_VERIFY_TLS,
  });
  const response = apiResponseSchema.parse(payload);

  return schema.parse(response.data);
}

function toHistory(
  points: z.infer<typeof rrdPointSchema>[],
  valueForPoint: (point: z.infer<typeof rrdPointSchema>) => number | null,
): TimeSeriesPoint[] {
  return points.flatMap((point) => {
    const value = valueForPoint(point);
    return value === null || !Number.isFinite(value)
      ? []
      : ([[point.time * 1_000, value]] as TimeSeriesPoint[]);
  });
}

function integrateSeries(series: TimeSeriesPoint[]): number {
  return series.slice(1).reduce((total, point, index) => {
    const previousPoint = series[index];
    const seconds = Math.max(0, (point[0] - previousPoint[0]) / 1_000);
    return total + ((previousPoint[1] + point[1]) / 2) * seconds;
  }, 0);
}

function latestValue(series: TimeSeriesPoint[]): number {
  return series.at(-1)?.[1] ?? 0;
}

function normalizeVmResources(
  resources: z.infer<typeof vmResourceSchema>[],
): Map<string, ProxmoxVmSnapshot> {
  return new Map(
    resources.map((resource) => {
      const maxMemory = Math.max(resource.maxmem, 0);
      const memoryPercent =
        maxMemory > 0 ? (resource.mem / maxMemory) * 100 : 0;

      return [
        String(resource.vmid),
        {
          id: String(resource.vmid),
          status: resource.status === "running" ? "up" : "down",
          cpuPercent: clampPercent(resource.cpu * 100),
          memoryPercent: clampPercent(memoryPercent),
          uptimeSeconds: resource.uptime,
        },
      ];
    }),
  );
}

export async function getProxmoxSnapshot(
  environment: RuntimeEnvironment,
): Promise<ProviderSnapshot> {
  const {
    PROXMOX_API_URL,
    PROXMOX_NODE,
    PROXMOX_TOKEN_ID,
    PROXMOX_TOKEN_SECRET,
  } = environment;

  if (
    !PROXMOX_API_URL ||
    !PROXMOX_NODE ||
    !PROXMOX_TOKEN_ID ||
    !PROXMOX_TOKEN_SECRET
  ) {
    throw new ProxmoxConfigurationError();
  }

  const encodedNode = encodeURIComponent(PROXMOX_NODE);
  const [status, rrdPoints, resources] = await Promise.all([
    getProxmoxData(
      endpoint(PROXMOX_API_URL, `/api2/json/nodes/${encodedNode}/status`),
      nodeStatusSchema,
      environment,
    ),
    getProxmoxData(
      endpoint(PROXMOX_API_URL, `/api2/json/nodes/${encodedNode}/rrddata`, {
        timeframe: "day",
        cf: "AVERAGE",
      }),
      z.array(rrdPointSchema),
      environment,
    ),
    getProxmoxData(
      endpoint(PROXMOX_API_URL, "/api2/json/cluster/resources", { type: "vm" }),
      z.array(vmResourceSchema),
      environment,
    ),
  ]);

  const cpuHistory = toHistory(rrdPoints, (point) =>
    point.cpu === null || point.cpu === undefined
      ? null
      : clampPercent(point.cpu * 100),
  );
  const memoryHistory = toHistory(rrdPoints, (point) => {
    if (
      !point.memtotal ||
      point.memused === null ||
      point.memused === undefined
    ) {
      return null;
    }

    return clampPercent((point.memused / point.memtotal) * 100);
  });
  const rxHistory = toHistory(rrdPoints, (point) => point.netin ?? null);
  const txHistory = toHistory(rrdPoints, (point) => point.netout ?? null);
  const totalMemory = status.memory.total;
  const memoryPercent =
    totalMemory > 0 ? (status.memory.used / totalMemory) * 100 : 0;
  const baseUrl = new URL(PROXMOX_API_URL);
  const threads = status.cpuinfo.cpus || status.cpuinfo.cores;

  const system: CoreSystem = {
    id: "proxmox",
    name: "Proxmox",
    address: baseUrl.hostname,
    version: status.pveversion.replace(/^pve-manager\//, "PVE ").split("/")[0],
    status: "up",
    uptimeSeconds: status.uptime,
    cpu: {
      percent: clampPercent(status.cpu * 100),
      cores: status.cpuinfo.cores,
      threads,
      history: cpuHistory,
    },
    memory: {
      percent: clampPercent(memoryPercent),
      usedBytes: status.memory.used,
      totalBytes: totalMemory,
      history: memoryHistory,
    },
    network: {
      rxBytesPerSecond: latestValue(rxHistory),
      txBytesPerSecond: latestValue(txHistory),
      totalRxBytes: integrateSeries(rxHistory),
      totalTxBytes: integrateSeries(txHistory),
      rxHistory,
      txHistory,
    },
  };

  return {
    system,
    virtualMachines: normalizeVmResources(resources),
  };
}
