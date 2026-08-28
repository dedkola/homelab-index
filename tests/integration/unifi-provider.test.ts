import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetHistoryForTests } from "@/features/dashboard/history";
import {
  getUniFiSnapshot,
  resetUniFiProviderCacheForTests,
} from "@/features/dashboard/providers/unifi";
import type { RuntimeEnvironment } from "@/lib/env";
import { requestJson } from "@/lib/http";

vi.mock("@/lib/http", () => ({
  requestJson: vi.fn(),
}));

const environment: RuntimeEnvironment = {
  DASHBOARD_POLL_INTERVAL_MS: 30_000,
  PROVIDER_TIMEOUT_MS: 8_000,
  PROXMOX_VERIFY_TLS: true,
  UNRAID_VERIFY_TLS: true,
  UNIFI_API_URL: "https://gateway.local/proxy/network/integration",
  UNIFI_API_KEY: "local-secret",
  UNIFI_VERIFY_TLS: false,
  UNIFI_SITE_MANAGER_API_URL: "https://api.ui.com",
  UNIFI_SITE_MANAGER_API_KEY: "cloud-secret",
};

describe("UniFi provider", () => {
  beforeEach(() => {
    resetHistoryForTests();
    resetUniFiProviderCacheForTests();
    vi.mocked(requestJson).mockReset();
    vi.mocked(requestJson).mockImplementation(async (url) => {
      if (url.hostname === "api.ui.com") {
        if (url.pathname === "/v1/sites") {
          return {
            data: [
              {
                siteId: "cloud-site",
                hostId: "host-1",
                meta: { gatewayMac: "aa:bb:cc:dd:ee:ff" },
                statistics: {
                  counts: {
                    gatewayDevice: 1,
                    guestClient: 0,
                    offlineDevice: 0,
                    offlineGatewayDevice: 0,
                    pendingUpdateDevice: 0,
                    totalDevice: 5,
                    wanConfiguration: 2,
                    wifiClient: 9,
                    wiredClient: 10,
                  },
                  gateway: { shortname: "UDRULT" },
                  internetIssues: [{ highLatency: true }],
                  ispInfo: { asn: 21497, name: "ISP" },
                  percentages: { wanUptime: 100 },
                },
              },
            ],
          };
        }

        return {
          data: [
            {
              siteId: "cloud-site",
              hostId: "host-1",
              metricType: "5m",
              periods: [
                {
                  metricTime: "2026-08-27T11:55:00.000Z",
                  data: {
                    wan: {
                      avgLatency: 3,
                      maxLatency: 8,
                      packetLoss: 0,
                      uptime: 100,
                      downtime: 0,
                      download_kbps: 1_000_000,
                      upload_kbps: 1_000_000,
                      ispAsn: "21497",
                      ispName: "ISP",
                    },
                  },
                },
                {
                  metricTime: "2026-08-27T12:00:00.000Z",
                  data: {
                    wan: {
                      avgLatency: 4,
                      maxLatency: 9,
                      packetLoss: 1,
                      uptime: 99,
                      downtime: 3,
                      download_kbps: 1_000_000,
                      upload_kbps: 1_000_000,
                      ispAsn: "21497",
                      ispName: "ISP",
                    },
                  },
                },
              ],
            },
          ],
        };
      }

      if (url.pathname.endsWith("/v1/info")) {
        return { applicationVersion: "10.5.67" };
      }

      if (url.pathname.endsWith("/v1/sites")) {
        return {
          offset: 0,
          limit: 25,
          count: 1,
          totalCount: 1,
          data: [{ id: "local-site", name: "Default" }],
        };
      }

      if (url.pathname.endsWith("/devices/gateway/statistics/latest")) {
        return {
          uptimeSec: 86_400,
          loadAverage1Min: 1.2,
          cpuUtilizationPct: 26.1,
          memoryUtilizationPct: 48.8,
          uplink: { rxRateBps: 800_000_000, txRateBps: 80_000_000 },
        };
      }

      if (url.pathname.endsWith("/devices/gateway")) {
        return {
          id: "gateway",
          name: "tk",
          model: "UCG Ultra",
          state: "ONLINE",
          firmwareVersion: "5.1.31",
          firmwareUpdatable: false,
          features: ["switching"],
          interfaces: {
            ports: [
              { idx: 1, state: "UP", maxSpeedMbps: 1_000 },
              { idx: 2, state: "DOWN", maxSpeedMbps: 1_000 },
            ],
          },
        };
      }

      if (url.pathname.endsWith("/devices")) {
        return {
          count: 2,
          totalCount: 2,
          data: [
            {
              id: "gateway",
              name: "tk",
              model: "UCG Ultra",
              state: "ONLINE",
              firmwareVersion: "5.1.31",
              firmwareUpdatable: false,
              features: ["switching"],
            },
            {
              id: "ap",
              name: "U7 Pro",
              model: "U7 Pro",
              state: "ONLINE",
              firmwareVersion: "8.7.11",
              firmwareUpdatable: false,
              features: ["accessPoint"],
            },
          ],
        };
      }

      if (url.pathname.endsWith("/clients")) {
        return {
          count: 3,
          totalCount: 3,
          data: [
            { type: "WIRED", access: { type: "DEFAULT" } },
            { type: "WIRELESS", access: { type: "DEFAULT" } },
            { type: "WIRELESS", access: { type: "GUEST" } },
          ],
        };
      }

      return {
        count: 2,
        totalCount: 2,
        data: [
          { id: "wan-1", name: "Internet 1" },
          { id: "wan-2", name: "Internet 2" },
        ],
      };
    });
  });

  it("combines live gateway data with Site Manager ISP history", async () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const snapshot = await getUniFiSnapshot(environment, now);

    expect(snapshot.issues).toEqual([]);
    expect(snapshot.network).toMatchObject({
      address: "gateway.local",
      model: "UCG Ultra",
      firmwareVersion: "5.1.31",
      applicationVersion: "10.5.67",
      status: "up",
      uptimeSeconds: 86_400,
      cpuPercent: 26.1,
      memoryPercent: 48.8,
      internetIssueCount: 1,
      traffic: {
        rxBytesPerSecond: 100_000_000,
        txBytesPerSecond: 10_000_000,
      },
      internet: {
        averageLatencyMs: 4,
        maximumLatencyMs: 9,
        packetLossPercent: 1,
        uptimePercent: 99,
        downloadKbps: 1_000_000,
        uploadKbps: 1_000_000,
      },
      clients: { total: 3, wired: 1, wireless: 2, guest: 1 },
      devices: {
        online: 2,
        total: 2,
        pendingUpdates: 0,
        portsUp: 1,
        portsTotal: 2,
        wanCount: 2,
      },
    });
    expect(snapshot.network.internet.latencyHistory).toEqual([
      [Date.parse("2026-08-27T11:55:00.000Z"), 3],
      [now, 4],
    ]);
    expect(snapshot.network.clients.history).toEqual([[now, 3]]);
    expect(snapshot.network.traffic.rxHistory).toEqual([[now, 100_000_000]]);
    expect(snapshot.network.traffic.txHistory).toEqual([[now, 10_000_000]]);
  });
});
