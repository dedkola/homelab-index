import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetHistoryForTests } from "@/features/dashboard/history";
import { getUnraidSnapshot } from "@/features/dashboard/providers/unraid";
import type { RuntimeEnvironment } from "@/lib/env";
import { requestJson } from "@/lib/http";

vi.mock("@/lib/http", () => ({
  requestJson: vi.fn(),
}));

const environment: RuntimeEnvironment = {
  DASHBOARD_POLL_INTERVAL_MS: 30_000,
  PROVIDER_TIMEOUT_MS: 8_000,
  PROXMOX_VERIFY_TLS: true,
  UNRAID_GRAPHQL_URL: "http://tower.local/graphql",
  UNRAID_API_KEY: "secret",
  UNRAID_NETWORK_INTERFACE: "br0",
  UNRAID_VERIFY_TLS: true,
  UNIFI_VERIFY_TLS: true,
  UNIFI_SITE_MANAGER_API_URL: "https://api.ui.com",
};

describe("Unraid provider", () => {
  beforeEach(() => {
    resetHistoryForTests();
    vi.mocked(requestJson).mockReset();
    vi.mocked(requestJson).mockResolvedValue({
      data: {
        info: {
          os: { hostname: "tower", uptime: "2026-08-26T12:00:00.000Z" },
          cpu: { cores: 12, threads: 24 },
          versions: { core: { unraid: "7.2.0" } },
          primaryNetwork: { name: "br0", ipAddress: "192.168.10.11" },
        },
        metrics: {
          cpu: { percentTotal: 27.1 },
          memory: { total: "64000", used: "32000", percentTotal: 50 },
          network: [
            {
              name: "br0",
              operstate: "up",
              bytesReceived: "1000000",
              bytesSent: "500000",
              rxSec: 125000000,
              txSec: 25000000,
            },
          ],
        },
      },
    });
  });

  it("normalizes GraphQL system metrics and records history", async () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const snapshot = await getUnraidSnapshot(environment, now);

    expect(snapshot.system).toMatchObject({
      address: "192.168.10.11",
      version: "7.2.0",
      uptimeSeconds: 86_400,
    });
    expect(snapshot.system.cpu).toMatchObject({
      percent: 27.1,
      cores: 12,
      threads: 24,
    });
    expect(snapshot.system.network).toMatchObject({
      rxBytesPerSecond: 125_000_000,
      txBytesPerSecond: 25_000_000,
      totalRxBytes: 1_000_000,
      totalTxBytes: 500_000,
    });
    expect(snapshot.system.cpu.history).toEqual([[now, 27.1]]);
  });
});
