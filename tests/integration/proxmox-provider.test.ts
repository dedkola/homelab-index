import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProxmoxSnapshot } from "@/features/dashboard/providers/proxmox";
import type { RuntimeEnvironment } from "@/lib/env";
import { requestJson } from "@/lib/http";

vi.mock("@/lib/http", () => ({
  requestJson: vi.fn(),
}));

const environment: RuntimeEnvironment = {
  DASHBOARD_POLL_INTERVAL_MS: 30_000,
  PROVIDER_TIMEOUT_MS: 8_000,
  PROXMOX_API_URL: "https://pve.local:8006",
  PROXMOX_NODE: "pve",
  PROXMOX_TOKEN_ID: "dashboard@pve!homelab",
  PROXMOX_TOKEN_SECRET: "secret",
  PROXMOX_VERIFY_TLS: false,
  UNRAID_VERIFY_TLS: true,
};

describe("Proxmox provider", () => {
  beforeEach(() => {
    vi.mocked(requestJson).mockReset();
    vi.mocked(requestJson).mockImplementation(async (url) => {
      if (url.pathname.endsWith("/status")) {
        return {
          data: {
            cpu: 0.25,
            uptime: 86_400,
            pveversion: "pve-manager/9.1.1/abc",
            memory: { used: 32_000, total: 64_000 },
            cpuinfo: { cores: 8, cpus: 16 },
          },
        };
      }

      if (url.pathname.endsWith("/rrddata")) {
        return {
          data: [
            {
              time: 1_000,
              cpu: 0.2,
              memused: 30,
              memtotal: 60,
              netin: 100,
              netout: 50,
            },
            {
              time: 1_060,
              cpu: 0.25,
              memused: 32,
              memtotal: 64,
              netin: 200,
              netout: 80,
            },
          ],
        };
      }

      return {
        data: [
          {
            vmid: 101,
            status: "running",
            cpu: 0.1,
            mem: 2_000,
            maxmem: 4_000,
            uptime: 3_600,
          },
        ],
      };
    });
  });

  it("normalizes node, RRD, and VM resource responses", async () => {
    const snapshot = await getProxmoxSnapshot(environment);

    expect(snapshot.system.version).toBe("PVE 9.1.1");
    expect(snapshot.system.cpu).toMatchObject({
      percent: 25,
      cores: 8,
      threads: 16,
    });
    expect(snapshot.system.memory.percent).toBe(50);
    expect(snapshot.system.network.rxBytesPerSecond).toBe(200);
    expect(snapshot.virtualMachines?.get("101")).toMatchObject({
      status: "up",
      cpuPercent: 10,
      memoryPercent: 50,
    });
  });
});
