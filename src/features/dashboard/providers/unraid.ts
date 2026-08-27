import "server-only";

import { z } from "zod";

import { recordHistoryPoint } from "@/features/dashboard/history";
import type { CoreSystem, ProviderSnapshot } from "@/features/dashboard/types";
import type { RuntimeEnvironment } from "@/lib/env";
import { clampPercent } from "@/lib/format";
import { requestJson } from "@/lib/http";

const scalarNumber = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value));

const unraidDataSchema = z.object({
  info: z.object({
    os: z.object({
      hostname: z.string().nullable().optional(),
      uptime: z.string().nullable().optional(),
    }),
    cpu: z.object({
      cores: z.number().nullable().optional(),
      threads: z.number().nullable().optional(),
    }),
    versions: z.object({
      core: z.object({
        unraid: z.string().nullable().optional(),
      }),
    }),
    primaryNetwork: z
      .object({
        name: z.string(),
        ipAddress: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  metrics: z.object({
    cpu: z
      .object({
        percentTotal: z.number(),
      })
      .nullable(),
    memory: z
      .object({
        total: scalarNumber,
        used: scalarNumber,
        percentTotal: z.number(),
      })
      .nullable(),
    network: z.array(
      z.object({
        name: z.string(),
        operstate: z.string(),
        bytesReceived: scalarNumber,
        bytesSent: scalarNumber,
        rxSec: z.number(),
        txSec: z.number(),
      }),
    ),
  }),
});

const graphQlResponseSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const UNRAID_QUERY = `
  query HomelabDashboard {
    info {
      os {
        hostname
        uptime
      }
      cpu {
        cores
        threads
      }
      versions {
        core {
          unraid
        }
      }
      primaryNetwork {
        name
        ipAddress
      }
    }
    metrics {
      cpu {
        percentTotal
      }
      memory {
        total
        used
        percentTotal
      }
      network {
        name
        operstate
        bytesReceived
        bytesSent
        rxSec
        txSec
      }
    }
  }
`;

export class UnraidConfigurationError extends Error {
  constructor() {
    super("Unraid environment is incomplete");
    this.name = "UnraidConfigurationError";
  }
}

function uptimeInSeconds(
  bootTime: string | null | undefined,
  now: number,
): number {
  if (!bootTime) {
    return 0;
  }

  const bootTimestamp = Date.parse(bootTime);
  return Number.isFinite(bootTimestamp)
    ? Math.max(0, (now - bootTimestamp) / 1_000)
    : 0;
}

export async function getUnraidSnapshot(
  environment: RuntimeEnvironment,
  now = Date.now(),
): Promise<ProviderSnapshot> {
  const { UNRAID_GRAPHQL_URL, UNRAID_API_KEY } = environment;

  if (!UNRAID_GRAPHQL_URL || !UNRAID_API_KEY) {
    throw new UnraidConfigurationError();
  }

  const rawResponse = await requestJson<unknown>(new URL(UNRAID_GRAPHQL_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": UNRAID_API_KEY,
    },
    body: JSON.stringify({ query: UNRAID_QUERY }),
    timeoutMs: environment.PROVIDER_TIMEOUT_MS,
    verifyTls: environment.UNRAID_VERIFY_TLS,
  });
  const graphQlResponse = graphQlResponseSchema.parse(rawResponse);

  if (!graphQlResponse.data) {
    throw new Error(
      graphQlResponse.errors?.[0]?.message ?? "Unraid returned no data",
    );
  }

  const data = unraidDataSchema.parse(graphQlResponse.data);
  const selectedInterfaceName =
    environment.UNRAID_NETWORK_INTERFACE ?? data.info.primaryNetwork?.name;
  const selectedInterfaces = data.metrics.network.filter((networkInterface) => {
    if (selectedInterfaceName) {
      return networkInterface.name === selectedInterfaceName;
    }

    return (
      networkInterface.operstate === "up" && networkInterface.name !== "lo"
    );
  });
  const networkInterfaces =
    selectedInterfaces.length > 0 ? selectedInterfaces : data.metrics.network;
  const network = networkInterfaces.reduce(
    (totals, networkInterface) => ({
      rxBytesPerSecond:
        totals.rxBytesPerSecond + Math.max(0, networkInterface.rxSec),
      txBytesPerSecond:
        totals.txBytesPerSecond + Math.max(0, networkInterface.txSec),
      totalRxBytes:
        totals.totalRxBytes + Math.max(0, networkInterface.bytesReceived),
      totalTxBytes:
        totals.totalTxBytes + Math.max(0, networkInterface.bytesSent),
    }),
    {
      rxBytesPerSecond: 0,
      txBytesPerSecond: 0,
      totalRxBytes: 0,
      totalTxBytes: 0,
    },
  );
  const cpuPercent = clampPercent(data.metrics.cpu?.percentTotal ?? 0);
  const memoryPercent = clampPercent(data.metrics.memory?.percentTotal ?? 0);
  const totalMemory = data.metrics.memory?.total ?? 0;
  const usedMemory = data.metrics.memory?.used ?? 0;
  const address =
    data.info.primaryNetwork?.ipAddress ?? new URL(UNRAID_GRAPHQL_URL).hostname;

  const system: CoreSystem = {
    id: "unraid",
    name: "Unraid",
    address,
    version: data.info.versions.core.unraid ?? "Unraid",
    status: "up",
    uptimeSeconds: uptimeInSeconds(data.info.os.uptime, now),
    cpu: {
      percent: cpuPercent,
      cores: data.info.cpu.cores ?? 0,
      threads: data.info.cpu.threads ?? data.info.cpu.cores ?? 0,
      history: recordHistoryPoint("unraid:cpu", now, cpuPercent),
    },
    memory: {
      percent: memoryPercent,
      usedBytes: usedMemory,
      totalBytes: totalMemory,
      history: recordHistoryPoint("unraid:memory", now, memoryPercent),
    },
    network: {
      ...network,
      rxHistory: recordHistoryPoint(
        "unraid:network:rx",
        now,
        network.rxBytesPerSecond,
      ),
      txHistory: recordHistoryPoint(
        "unraid:network:tx",
        now,
        network.txBytesPerSecond,
      ),
    },
  };

  return { system };
}
