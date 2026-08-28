import "server-only";

import { z } from "zod";

import { recordHistoryPoint } from "@/features/dashboard/history";
import type {
  Availability,
  DashboardIssue,
  TimeSeriesPoint,
  UniFiNetwork,
} from "@/features/dashboard/types";
import type { RuntimeEnvironment } from "@/lib/env";
import { clampPercent } from "@/lib/format";
import { requestJson } from "@/lib/http";

const nullableNumber = z.number().nullable().optional();
const nullableString = z.string().nullable().optional();
const EMPTY_SITE_MANAGER_COUNTS = {
  gatewayDevice: 0,
  guestClient: 0,
  offlineDevice: 0,
  offlineGatewayDevice: 0,
  pendingUpdateDevice: 0,
  totalDevice: 0,
  wanConfiguration: 0,
  wifiClient: 0,
  wiredClient: 0,
};

const localSiteSchema = z.object({
  id: z.string(),
  internalReference: z.string().optional(),
  name: z.string().optional(),
});

const localDeviceSchema = z.object({
  id: z.string(),
  macAddress: z.string().optional(),
  ipAddress: z.string().optional(),
  name: z.string().optional(),
  model: z.string().optional(),
  state: z.string().optional(),
  firmwareVersion: z.string().optional(),
  firmwareUpdatable: z.boolean().optional().default(false),
  features: z.array(z.string()).optional().default([]),
});

const localClientSchema = z.object({
  type: z.string(),
  access: z.object({ type: z.string().optional() }).passthrough().optional(),
});

const pageSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    count: z.number().optional().default(0),
    totalCount: z.number().optional().default(0),
    data: z.array(itemSchema).optional().default([]),
  });

const localInfoSchema = z.object({
  applicationVersion: z.string().optional().default("—"),
});

const localWanSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const localDeviceDetailsSchema = z
  .object({
    interfaces: z
      .object({
        ports: z
          .array(
            z.object({
              idx: z.number(),
              state: z.string(),
              speedMbps: z.number().optional(),
              maxSpeedMbps: z.number().optional(),
            }),
          )
          .optional()
          .default([]),
      })
      .passthrough()
      .optional()
      .default({ ports: [] }),
  })
  .passthrough();

const localDeviceStatisticsSchema = z.object({
  uptimeSec: nullableNumber,
  loadAverage1Min: nullableNumber,
  cpuUtilizationPct: nullableNumber,
  memoryUtilizationPct: nullableNumber,
  uplink: z
    .object({
      rxRateBps: nullableNumber,
      txRateBps: nullableNumber,
    })
    .optional(),
});

const siteManagerWanMetricSchema = z.object({
  avgLatency: nullableNumber,
  download_kbps: nullableNumber,
  downtime: nullableNumber,
  ispAsn: nullableString,
  ispName: nullableString,
  maxLatency: nullableNumber,
  packetLoss: nullableNumber,
  upload_kbps: nullableNumber,
  uptime: nullableNumber,
});

const siteManagerMetricSeriesSchema = z.object({
  siteId: z.string(),
  hostId: z.string().optional(),
  metricType: z.string().optional(),
  periods: z
    .array(
      z.object({
        metricTime: z.string(),
        data: z.object({ wan: siteManagerWanMetricSchema }).passthrough(),
      }),
    )
    .optional()
    .default([]),
});

const siteManagerMetricsResponseSchema = z.object({
  data: z.array(siteManagerMetricSeriesSchema).optional().default([]),
});

const siteManagerCountsSchema = z.object({
  gatewayDevice: z.number().optional().default(0),
  guestClient: z.number().optional().default(0),
  offlineDevice: z.number().optional().default(0),
  offlineGatewayDevice: z.number().optional().default(0),
  pendingUpdateDevice: z.number().optional().default(0),
  totalDevice: z.number().optional().default(0),
  wanConfiguration: z.number().optional().default(0),
  wifiClient: z.number().optional().default(0),
  wiredClient: z.number().optional().default(0),
});

const siteManagerSiteSchema = z.object({
  siteId: z.string(),
  hostId: z.string(),
  meta: z
    .object({
      gatewayMac: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough()
    .optional()
    .default({}),
  statistics: z
    .object({
      counts: siteManagerCountsSchema
        .optional()
        .default(EMPTY_SITE_MANAGER_COUNTS),
      gateway: z
        .object({ shortname: z.string().optional() })
        .passthrough()
        .optional(),
      internetIssues: z.array(z.unknown()).optional().default([]),
      ispInfo: z
        .object({
          asn: z.union([z.string(), z.number()]).optional(),
          name: z.string().optional(),
          organization: z.string().optional(),
        })
        .passthrough()
        .optional(),
      percentages: z
        .object({ wanUptime: nullableNumber })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional()
    .default({
      counts: EMPTY_SITE_MANAGER_COUNTS,
      internetIssues: [],
    }),
});

const siteManagerSitesResponseSchema = z.object({
  data: z.array(siteManagerSiteSchema).optional().default([]),
});

type LocalDevice = z.infer<typeof localDeviceSchema>;
type SiteManagerMetricsResponse = z.infer<
  typeof siteManagerMetricsResponseSchema
>;

interface LocalOverview {
  applicationVersion: string;
  gateway: LocalDevice;
  details: z.infer<typeof localDeviceDetailsSchema>;
  statistics: z.infer<typeof localDeviceStatisticsSchema>;
  clients: z.infer<typeof localClientSchema>[];
  devices: LocalDevice[];
  wanCount: number;
}

interface SiteManagerOverview {
  site: z.infer<typeof siteManagerSiteSchema>;
  metrics: z.infer<typeof siteManagerMetricSeriesSchema> | undefined;
}

interface UniFiProviderSnapshot {
  network: UniFiNetwork;
  issues: DashboardIssue[];
}

const SITE_MANAGER_METRICS_CACHE_MS = 5 * 60 * 1_000;
let metricsCache:
  { expiresAt: number; response: SiteManagerMetricsResponse } | undefined;

export class UniFiConfigurationError extends Error {
  constructor(message = "UniFi environment is incomplete") {
    super(message);
    this.name = "UniFiConfigurationError";
  }
}

function endpoint(baseUrl: string, path: string): URL {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBaseUrl);
}

async function getLocalJson<T>(
  environment: RuntimeEnvironment,
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!environment.UNIFI_API_URL || !environment.UNIFI_API_KEY) {
    throw new UniFiConfigurationError("UniFi local environment is incomplete");
  }

  const payload = await requestJson<unknown>(
    endpoint(environment.UNIFI_API_URL, path),
    {
      headers: { "x-api-key": environment.UNIFI_API_KEY },
      timeoutMs: environment.PROVIDER_TIMEOUT_MS,
      verifyTls: environment.UNIFI_VERIFY_TLS,
    },
  );

  return schema.parse(payload);
}

async function getSiteManagerJson<T>(
  environment: RuntimeEnvironment,
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!environment.UNIFI_SITE_MANAGER_API_KEY) {
    throw new UniFiConfigurationError(
      "UniFi Site Manager environment is incomplete",
    );
  }

  const payload = await requestJson<unknown>(
    endpoint(environment.UNIFI_SITE_MANAGER_API_URL, path),
    {
      headers: { "x-api-key": environment.UNIFI_SITE_MANAGER_API_KEY },
      timeoutMs: environment.PROVIDER_TIMEOUT_MS,
      verifyTls: true,
    },
  );

  return schema.parse(payload);
}

function selectLocalSite(
  sites: z.infer<typeof localSiteSchema>[],
  configuredSiteId: string | undefined,
): z.infer<typeof localSiteSchema> {
  const selectedSite = configuredSiteId
    ? sites.find((site) => site.id === configuredSiteId)
    : sites.length === 1
      ? sites[0]
      : undefined;

  if (!selectedSite) {
    throw new UniFiConfigurationError("UniFi local site selection is required");
  }

  return selectedSite;
}

function selectGateway(
  devices: LocalDevice[],
  configuredGatewayId: string | undefined,
): LocalDevice {
  const selectedGateway = configuredGatewayId
    ? devices.find((device) => device.id === configuredGatewayId)
    : devices.find(
        (device) =>
          device.features.includes("gateway") ||
          /\b(ucg|udm|uxg|gateway|dream)\b/i.test(device.model ?? ""),
      );

  if (!selectedGateway) {
    throw new UniFiConfigurationError("UniFi gateway selection is required");
  }

  return selectedGateway;
}

async function getLocalOverview(
  environment: RuntimeEnvironment,
): Promise<LocalOverview> {
  const [info, sites] = await Promise.all([
    getLocalJson(environment, "v1/info", localInfoSchema),
    getLocalJson(
      environment,
      "v1/sites?offset=0&limit=25",
      pageSchema(localSiteSchema),
    ),
  ]);
  const site = selectLocalSite(sites.data, environment.UNIFI_SITE_ID);
  const sitePath = `v1/sites/${encodeURIComponent(site.id)}`;
  const [siteDevices, siteClients, siteWans] = await Promise.all([
    getLocalJson(
      environment,
      `${sitePath}/devices?offset=0&limit=200`,
      pageSchema(localDeviceSchema),
    ),
    getLocalJson(
      environment,
      `${sitePath}/clients?offset=0&limit=200`,
      pageSchema(localClientSchema),
    ),
    getLocalJson(
      environment,
      `${sitePath}/wans?offset=0&limit=25`,
      pageSchema(localWanSchema),
    ),
  ]);
  const gateway = selectGateway(siteDevices.data, environment.UNIFI_GATEWAY_ID);
  const gatewayPath = `${sitePath}/devices/${encodeURIComponent(gateway.id)}`;
  const [details, statistics] = await Promise.all([
    getLocalJson(environment, gatewayPath, localDeviceDetailsSchema),
    getLocalJson(
      environment,
      `${gatewayPath}/statistics/latest`,
      localDeviceStatisticsSchema,
    ),
  ]);

  return {
    applicationVersion: info.applicationVersion,
    gateway,
    details,
    statistics,
    clients: siteClients.data,
    devices: siteDevices.data,
    wanCount: siteWans.totalCount,
  };
}

async function getSiteManagerMetrics(
  environment: RuntimeEnvironment,
  now: number,
): Promise<SiteManagerMetricsResponse> {
  if (metricsCache && metricsCache.expiresAt > now) {
    return metricsCache.response;
  }

  const response = await getSiteManagerJson(
    environment,
    "v1/isp-metrics/5m?duration=24h",
    siteManagerMetricsResponseSchema,
  );
  metricsCache = {
    expiresAt: now + SITE_MANAGER_METRICS_CACHE_MS,
    response,
  };
  return response;
}

function selectSiteManagerSite(
  sites: z.infer<typeof siteManagerSiteSchema>[],
  configuredSiteId: string | undefined,
): z.infer<typeof siteManagerSiteSchema> {
  const selectedSite = configuredSiteId
    ? sites.find((site) => site.siteId === configuredSiteId)
    : sites.length === 1
      ? sites[0]
      : undefined;

  if (!selectedSite) {
    throw new UniFiConfigurationError(
      "UniFi Site Manager site selection is required",
    );
  }

  return selectedSite;
}

async function getSiteManagerOverview(
  environment: RuntimeEnvironment,
  now: number,
): Promise<SiteManagerOverview> {
  const [sites, metrics] = await Promise.all([
    getSiteManagerJson(
      environment,
      "v1/sites?pageSize=100",
      siteManagerSitesResponseSchema,
    ),
    getSiteManagerMetrics(environment, now),
  ]);
  const site = selectSiteManagerSite(
    sites.data,
    environment.UNIFI_SITE_MANAGER_SITE_ID,
  );

  return {
    site,
    metrics: metrics.data.find((series) => series.siteId === site.siteId),
  };
}

function toHistory(
  periods: z.infer<typeof siteManagerMetricSeriesSchema>["periods"],
  valueForPeriod: (
    wan: z.infer<typeof siteManagerWanMetricSchema>,
  ) => number | null | undefined,
): TimeSeriesPoint[] {
  return periods
    .flatMap((period) => {
      const timestamp = Date.parse(period.metricTime);
      const value = valueForPeriod(period.data.wan);

      return Number.isFinite(timestamp) && value !== null && value !== undefined
        ? ([[timestamp, value]] as TimeSeriesPoint[])
        : [];
    })
    .sort((left, right) => left[0] - right[0]);
}

function latestWanMetric(
  overview: SiteManagerOverview | undefined,
): z.infer<typeof siteManagerWanMetricSchema> | undefined {
  return overview?.metrics?.periods.at(-1)?.data.wan;
}

function issueForResult(
  result: PromiseSettledResult<unknown>,
): DashboardIssue | undefined {
  if (result.status === "fulfilled") {
    return undefined;
  }

  return {
    source: "unifi",
    code:
      result.reason instanceof UniFiConfigurationError
        ? "configuration"
        : "unavailable",
  };
}

function localStatus(local: LocalOverview | undefined): Availability | null {
  if (!local) {
    return null;
  }

  return local.gateway.state === "ONLINE" ? "up" : "down";
}

function siteManagerStatus(
  overview: SiteManagerOverview | undefined,
): Availability | null {
  if (!overview) {
    return null;
  }

  const counts = overview.site.statistics.counts;
  return counts.gatewayDevice > 0 && counts.offlineGatewayDevice === 0
    ? "up"
    : "down";
}

export async function getUniFiSnapshot(
  environment: RuntimeEnvironment,
  now = Date.now(),
): Promise<UniFiProviderSnapshot> {
  const localConfigured = Boolean(
    environment.UNIFI_API_URL && environment.UNIFI_API_KEY,
  );
  const siteManagerConfigured = Boolean(environment.UNIFI_SITE_MANAGER_API_KEY);

  if (!localConfigured && !siteManagerConfigured) {
    throw new UniFiConfigurationError();
  }

  const [localResult, siteManagerResult] = await Promise.allSettled([
    localConfigured
      ? getLocalOverview(environment)
      : Promise.reject(
          new UniFiConfigurationError("UniFi local environment is incomplete"),
        ),
    siteManagerConfigured
      ? getSiteManagerOverview(environment, now)
      : Promise.reject(
          new UniFiConfigurationError(
            "UniFi Site Manager environment is incomplete",
          ),
        ),
  ]);

  if (
    localResult.status === "rejected" &&
    siteManagerResult.status === "rejected"
  ) {
    if (
      localResult.reason instanceof UniFiConfigurationError &&
      siteManagerResult.reason instanceof UniFiConfigurationError
    ) {
      throw new UniFiConfigurationError();
    }

    throw new Error("UniFi providers are unavailable");
  }

  const local =
    localResult.status === "fulfilled" ? localResult.value : undefined;
  const siteManager =
    siteManagerResult.status === "fulfilled"
      ? siteManagerResult.value
      : undefined;
  const siteCounts = siteManager?.site.statistics.counts;
  const latestInternet = latestWanMetric(siteManager);
  const metricPeriods = siteManager?.metrics?.periods ?? [];
  const localClients = local?.clients ?? [];
  const clientTotal = local
    ? localClients.length
    : siteCounts
      ? siteCounts.wiredClient + siteCounts.wifiClient + siteCounts.guestClient
      : null;
  const rxBytesPerSecond = local?.statistics.uplink?.rxRateBps ?? null;
  const txBytesPerSecond = local?.statistics.uplink?.txRateBps ?? null;
  const ports = local?.details.interfaces.ports ?? [];
  const status =
    localStatus(local) ?? siteManagerStatus(siteManager) ?? "unknown";
  const siteIspInfo = siteManager?.site.statistics.ispInfo;
  const issues = [
    issueForResult(localResult),
    issueForResult(siteManagerResult),
  ].filter((issue): issue is DashboardIssue => Boolean(issue));

  const network: UniFiNetwork = {
    name: "UniFi",
    address: environment.UNIFI_API_URL
      ? new URL(environment.UNIFI_API_URL).hostname
      : "—",
    model:
      local?.gateway.model ??
      siteManager?.site.statistics.gateway?.shortname ??
      "Gateway",
    firmwareVersion: local?.gateway.firmwareVersion ?? "—",
    applicationVersion: local?.applicationVersion ?? "—",
    status,
    uptimeSeconds: local?.statistics.uptimeSec ?? null,
    cpuPercent:
      local?.statistics.cpuUtilizationPct === null ||
      local?.statistics.cpuUtilizationPct === undefined
        ? null
        : clampPercent(local.statistics.cpuUtilizationPct),
    memoryPercent:
      local?.statistics.memoryUtilizationPct === null ||
      local?.statistics.memoryUtilizationPct === undefined
        ? null
        : clampPercent(local.statistics.memoryUtilizationPct),
    loadAverage1Min: local?.statistics.loadAverage1Min ?? null,
    internetIssueCount: siteManager?.site.statistics.internetIssues.length ?? 0,
    traffic: {
      rxBytesPerSecond,
      txBytesPerSecond,
      rxHistory:
        rxBytesPerSecond === null
          ? []
          : recordHistoryPoint("unifi:traffic:rx", now, rxBytesPerSecond),
      txHistory:
        txBytesPerSecond === null
          ? []
          : recordHistoryPoint("unifi:traffic:tx", now, txBytesPerSecond),
    },
    internet: {
      ispName: latestInternet?.ispName ?? siteIspInfo?.name ?? null,
      ispAsn:
        latestInternet?.ispAsn ??
        (siteIspInfo?.asn === undefined ? null : String(siteIspInfo.asn)),
      averageLatencyMs: latestInternet?.avgLatency ?? null,
      maximumLatencyMs: latestInternet?.maxLatency ?? null,
      packetLossPercent: latestInternet?.packetLoss ?? null,
      uptimePercent:
        latestInternet?.uptime ??
        siteManager?.site.statistics.percentages?.wanUptime ??
        null,
      downtimeSeconds: latestInternet?.downtime ?? null,
      downloadKbps: latestInternet?.download_kbps ?? null,
      uploadKbps: latestInternet?.upload_kbps ?? null,
      latencyHistory: toHistory(metricPeriods, (wan) => wan.avgLatency),
      maximumLatencyHistory: toHistory(metricPeriods, (wan) => wan.maxLatency),
      packetLossHistory: toHistory(metricPeriods, (wan) => wan.packetLoss),
    },
    clients: {
      total: clientTotal,
      wired: local
        ? localClients.filter((client) => client.type === "WIRED").length
        : (siteCounts?.wiredClient ?? null),
      wireless: local
        ? localClients.filter((client) => client.type === "WIRELESS").length
        : (siteCounts?.wifiClient ?? null),
      guest: local
        ? localClients.filter((client) => client.access?.type === "GUEST")
            .length
        : (siteCounts?.guestClient ?? null),
      vpn: local
        ? localClients.filter(
            (client) => client.type === "VPN" || client.type === "TELEPORT",
          ).length
        : null,
      history:
        clientTotal === null
          ? []
          : recordHistoryPoint("unifi:clients", now, clientTotal),
    },
    devices: {
      online: local
        ? local.devices.filter((device) => device.state === "ONLINE").length
        : siteCounts
          ? Math.max(0, siteCounts.totalDevice - siteCounts.offlineDevice)
          : null,
      total: local?.devices.length ?? siteCounts?.totalDevice ?? null,
      pendingUpdates: local
        ? local.devices.filter((device) => device.firmwareUpdatable).length
        : (siteCounts?.pendingUpdateDevice ?? null),
      portsUp: local
        ? ports.filter((port) => port.state === "UP").length
        : null,
      portsTotal: local ? ports.length : null,
      wanCount: local?.wanCount ?? siteCounts?.wanConfiguration ?? null,
    },
  };

  return { network, issues };
}

export function resetUniFiProviderCacheForTests(): void {
  metricsCache = undefined;
}
