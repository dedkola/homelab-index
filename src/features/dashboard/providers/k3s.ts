import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { z } from "zod";

import { recordHistoryPoint } from "@/features/dashboard/history";
import type {
  Availability,
  K3sCluster,
  K3sNode,
} from "@/features/dashboard/types";
import type { RuntimeEnvironment } from "@/lib/env";
import { clampPercent } from "@/lib/format";
import { requestJson } from "@/lib/http";

const namedContextSchema = z.object({
  name: z.string(),
  context: z.object({
    cluster: z.string(),
    user: z.string(),
  }),
});

const namedClusterSchema = z.object({
  name: z.string(),
  cluster: z
    .object({
      server: z.string().url(),
      "certificate-authority-data": z.string().optional(),
      "certificate-authority": z.string().optional(),
      "insecure-skip-tls-verify": z.boolean().optional().default(false),
    })
    .passthrough(),
});

const namedUserSchema = z.object({
  name: z.string(),
  user: z
    .object({
      token: z.string().optional(),
      tokenFile: z.string().optional(),
      "client-certificate-data": z.string().optional(),
      "client-certificate": z.string().optional(),
      "client-key-data": z.string().optional(),
      "client-key": z.string().optional(),
    })
    .passthrough(),
});

const kubeconfigSchema = z.object({
  apiVersion: z.literal("v1"),
  kind: z.literal("Config"),
  "current-context": z.string(),
  contexts: z.array(namedContextSchema),
  clusters: z.array(namedClusterSchema),
  users: z.array(namedUserSchema),
});

const versionSchema = z.object({
  gitVersion: z.string(),
});

const nodeSchema = z.object({
  metadata: z.object({
    name: z.string(),
    labels: z.record(z.string(), z.string()).optional().default({}),
  }),
  status: z.object({
    conditions: z
      .array(z.object({ type: z.string(), status: z.string() }))
      .optional()
      .default([]),
    addresses: z
      .array(z.object({ type: z.string(), address: z.string() }))
      .optional()
      .default([]),
    allocatable: z.record(z.string(), z.string()).optional().default({}),
    nodeInfo: z.object({ kubeletVersion: z.string() }),
  }),
});

const nodeListSchema = z.object({ items: z.array(nodeSchema) });

const podListSchema = z.object({
  items: z.array(
    z.object({
      spec: z.object({ nodeName: z.string().optional() }),
    }),
  ),
});

const metricsDiscoverySchema = z.object({
  preferredVersion: z.object({ groupVersion: z.string() }),
});

const nodeMetricsListSchema = z.object({
  items: z.array(
    z.object({
      metadata: z.object({ name: z.string() }),
      usage: z.object({ cpu: z.string(), memory: z.string() }),
    }),
  ),
});

interface KubeconfigConnection {
  server: string;
  authorization?: string;
  verifyTls: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export class K3sConfigurationError extends Error {
  constructor(
    message = "K3s kubeconfig is unavailable",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "K3sConfigurationError";
  }
}

function resolveConfigPath(configPath: string): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configPath);
}

function decodeBase64(value: string, label: string): string {
  const decoded = Buffer.from(value, "base64").toString("utf8");

  if (!decoded.trim()) {
    throw new K3sConfigurationError(`K3s ${label} is empty`);
  }

  return decoded;
}

async function readReferencedFile(
  configDirectory: string,
  filePath: string,
): Promise<string> {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(configDirectory, filePath);

  return readFile(absolutePath, "utf8");
}

export async function loadK3sConnection(
  configPath: string,
): Promise<KubeconfigConnection> {
  const absolutePath = resolveConfigPath(configPath);

  try {
    const configDirectory = path.dirname(absolutePath);
    const kubeconfig = kubeconfigSchema.parse(
      parse(await readFile(absolutePath, "utf8")),
    );
    const context = kubeconfig.contexts.find(
      (candidate) => candidate.name === kubeconfig["current-context"],
    );

    if (!context) {
      throw new K3sConfigurationError("K3s current context does not exist");
    }

    const cluster = kubeconfig.clusters.find(
      (candidate) => candidate.name === context.context.cluster,
    )?.cluster;
    const user = kubeconfig.users.find(
      (candidate) => candidate.name === context.context.user,
    )?.user;

    if (!cluster || !user) {
      throw new K3sConfigurationError(
        "K3s current context has no cluster or user",
      );
    }

    const serverUrl = new URL(cluster.server);

    if (serverUrl.protocol !== "https:") {
      throw new K3sConfigurationError("K3s API must use HTTPS");
    }

    const ca = cluster["certificate-authority-data"]
      ? decodeBase64(cluster["certificate-authority-data"], "CA certificate")
      : cluster["certificate-authority"]
        ? await readReferencedFile(
            configDirectory,
            cluster["certificate-authority"],
          )
        : undefined;
    const token = user.token
      ? user.token.trim()
      : user.tokenFile
        ? (await readReferencedFile(configDirectory, user.tokenFile)).trim()
        : undefined;
    const cert = user["client-certificate-data"]
      ? decodeBase64(user["client-certificate-data"], "client certificate")
      : user["client-certificate"]
        ? await readReferencedFile(configDirectory, user["client-certificate"])
        : undefined;
    const key = user["client-key-data"]
      ? decodeBase64(user["client-key-data"], "client key")
      : user["client-key"]
        ? await readReferencedFile(configDirectory, user["client-key"])
        : undefined;

    if (!token && !(cert && key)) {
      throw new K3sConfigurationError(
        "K3s kubeconfig needs a token or client certificate and key",
      );
    }

    if ((cert && !key) || (!cert && key)) {
      throw new K3sConfigurationError(
        "K3s client certificate and key must be configured together",
      );
    }

    return {
      server: serverUrl.toString(),
      authorization: token ? `Bearer ${token}` : undefined,
      verifyTls: !cluster["insecure-skip-tls-verify"],
      ca,
      cert,
      key,
    };
  } catch (error) {
    if (error instanceof K3sConfigurationError) {
      throw error;
    }

    throw new K3sConfigurationError(
      `Unable to load K3s kubeconfig at ${absolutePath}`,
      { cause: error },
    );
  }
}

function endpoint(server: string, apiPath: string): URL {
  const baseUrl = server.endsWith("/") ? server : `${server}/`;
  return new URL(apiPath.replace(/^\//, ""), baseUrl);
}

async function getK3sData<T>(
  connection: KubeconfigConnection,
  apiPath: string,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T> {
  const payload = await requestJson<unknown>(
    endpoint(connection.server, apiPath),
    {
      headers: connection.authorization
        ? { authorization: connection.authorization }
        : undefined,
      timeoutMs,
      verifyTls: connection.verifyTls,
      ca: connection.ca,
      cert: connection.cert,
      key: connection.key,
    },
  );

  return schema.parse(payload);
}

function parseQuantity(
  value: string | undefined,
  multipliers: Record<string, number>,
): number {
  if (!value) {
    return 0;
  }

  const match = value.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)([a-zA-Z]*)$/,
  );

  if (!match) {
    return 0;
  }

  const multiplier = multipliers[match[2]];
  const numericValue = Number(match[1]);

  return multiplier === undefined || !Number.isFinite(numericValue)
    ? 0
    : numericValue * multiplier;
}

function parseCpuCores(value: string | undefined): number {
  return parseQuantity(value, {
    "": 1,
    n: 1e-9,
    u: 1e-6,
    m: 1e-3,
    k: 1e3,
    M: 1e6,
    G: 1e9,
  });
}

function parseBytes(value: string | undefined): number {
  return parseQuantity(value, {
    "": 1,
    k: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
    Ki: 2 ** 10,
    Mi: 2 ** 20,
    Gi: 2 ** 30,
    Ti: 2 ** 40,
    Pi: 2 ** 50,
    Ei: 2 ** 60,
  });
}

function nodeRole(labels: Record<string, string>): string {
  const roles = Object.keys(labels)
    .filter((label) => label.startsWith("node-role.kubernetes.io/"))
    .map((label) => label.replace("node-role.kubernetes.io/", ""))
    .filter(Boolean);

  return roles[0] ?? "worker";
}

function nodeAvailability(
  conditions: Array<{ type: string; status: string }>,
): Availability {
  const ready = conditions.find((condition) => condition.type === "Ready");

  if (!ready) {
    return "unknown";
  }

  return ready.status === "True" ? "up" : "down";
}

export async function getK3sSnapshot(
  environment: RuntimeEnvironment,
  now = Date.now(),
): Promise<K3sCluster> {
  const connection = await loadK3sConnection(environment.K3S_CONFIG_PATH);
  const [version, nodeList, podList, metricsDiscovery] = await Promise.all([
    getK3sData(
      connection,
      "/version",
      versionSchema,
      environment.PROVIDER_TIMEOUT_MS,
    ),
    getK3sData(
      connection,
      "/api/v1/nodes",
      nodeListSchema,
      environment.PROVIDER_TIMEOUT_MS,
    ),
    getK3sData(
      connection,
      "/api/v1/pods",
      podListSchema,
      environment.PROVIDER_TIMEOUT_MS,
    ),
    getK3sData(
      connection,
      "/apis/metrics.k8s.io",
      metricsDiscoverySchema,
      environment.PROVIDER_TIMEOUT_MS,
    ),
  ]);
  const metricsGroupVersion = metricsDiscovery.preferredVersion.groupVersion;

  if (!/^metrics\.k8s\.io\/v[\w.-]+$/.test(metricsGroupVersion)) {
    throw new Error("K3s returned an invalid metrics API version");
  }

  const nodeMetrics = await getK3sData(
    connection,
    `/apis/${metricsGroupVersion}/nodes`,
    nodeMetricsListSchema,
    environment.PROVIDER_TIMEOUT_MS,
  );
  const metricsByNode = new Map(
    nodeMetrics.items.map((metric) => [metric.metadata.name, metric.usage]),
  );
  const podsByNode = new Map<string, number>();

  for (const pod of podList.items) {
    if (pod.spec.nodeName) {
      podsByNode.set(
        pod.spec.nodeName,
        (podsByNode.get(pod.spec.nodeName) ?? 0) + 1,
      );
    }
  }

  const nodes: K3sNode[] = nodeList.items
    .map((node) => {
      const name = node.metadata.name;
      const usage = metricsByNode.get(name);
      const cpuAllocatableCores = parseCpuCores(node.status.allocatable.cpu);
      const memoryAllocatableBytes = parseBytes(node.status.allocatable.memory);
      const cpuUsedCores = usage ? parseCpuCores(usage.cpu) : null;
      const memoryUsedBytes = usage ? parseBytes(usage.memory) : null;
      const cpuPercent =
        cpuUsedCores !== null && cpuAllocatableCores > 0
          ? clampPercent((cpuUsedCores / cpuAllocatableCores) * 100)
          : null;
      const memoryPercent =
        memoryUsedBytes !== null && memoryAllocatableBytes > 0
          ? clampPercent((memoryUsedBytes / memoryAllocatableBytes) * 100)
          : null;
      const podCount = podsByNode.get(name) ?? 0;
      const role = nodeRole(node.metadata.labels);

      return {
        name,
        address:
          node.status.addresses.find((address) => address.type === "InternalIP")
            ?.address ??
          node.status.addresses[0]?.address ??
          "—",
        role,
        version: node.status.nodeInfo.kubeletVersion,
        status: nodeAvailability(node.status.conditions),
        cpuPercent,
        cpuUsedCores,
        cpuAllocatableCores,
        memoryPercent,
        memoryUsedBytes,
        memoryAllocatableBytes,
        podCount,
        cpuHistory:
          cpuPercent === null
            ? []
            : recordHistoryPoint(`k3s:${name}:cpu`, now, cpuPercent),
        memoryHistory:
          memoryPercent === null
            ? []
            : recordHistoryPoint(`k3s:${name}:memory`, now, memoryPercent),
        podHistory: recordHistoryPoint(`k3s:${name}:pods`, now, podCount),
      };
    })
    .sort((left, right) => {
      const leftControlPlane = left.role === "control-plane" ? 0 : 1;
      const rightControlPlane = right.role === "control-plane" ? 0 : 1;
      return (
        leftControlPlane - rightControlPlane ||
        left.name.localeCompare(right.name)
      );
    });
  const serverUrl = new URL(connection.server);
  const nodesReady = nodes.filter((node) => node.status === "up").length;

  return {
    name: "K3s",
    address: serverUrl.hostname,
    version: version.gitVersion,
    status:
      nodes.length > 0 && nodesReady === nodes.length
        ? "up"
        : nodesReady > 0
          ? "unknown"
          : "down",
    nodesReady,
    nodesTotal: nodes.length,
    podsTotal: podList.items.length,
    nodes,
  };
}
