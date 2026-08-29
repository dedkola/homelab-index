import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetHistoryForTests } from "@/features/dashboard/history";
import { getK3sSnapshot } from "@/features/dashboard/providers/k3s";
import type { RuntimeEnvironment } from "@/lib/env";
import { requestJson } from "@/lib/http";

vi.mock("@/lib/http", () => ({
  requestJson: vi.fn(),
}));

let temporaryDirectory = "";
let environment: RuntimeEnvironment;

describe("K3s provider", () => {
  beforeEach(async () => {
    resetHistoryForTests();
    vi.mocked(requestJson).mockReset();
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "homelab-k3s-"));
    const configPath = path.join(temporaryDirectory, "k3s.config");

    await writeFile(
      configPath,
      `apiVersion: v1
kind: Config
current-context: homelab-index
clusters:
  - name: k3s
    cluster:
      server: https://192.168.0.240:6443
      certificate-authority-data: ${Buffer.from("test-ca").toString("base64")}
contexts:
  - name: homelab-index
    context:
      cluster: k3s
      user: reader
users:
  - name: reader
    user:
      token: test-token
`,
      { mode: 0o600 },
    );

    environment = {
      DASHBOARD_POLL_INTERVAL_MS: 30_000,
      PROVIDER_TIMEOUT_MS: 8_000,
      HOSTS_CONFIG_PATH: "config/hosts.json",
      K3S_CONFIG_PATH: configPath,
      PROXMOX_VERIFY_TLS: true,
      UNRAID_VERIFY_TLS: true,
      UNIFI_VERIFY_TLS: true,
      UNIFI_SITE_MANAGER_API_URL: "https://api.ui.com",
    };

    vi.mocked(requestJson).mockImplementation(async (url) => {
      if (url.pathname === "/version") {
        return { gitVersion: "v1.36.2+k3s1" };
      }

      if (url.pathname === "/api/v1/nodes") {
        return {
          items: [
            {
              metadata: {
                name: "k3s-agent-1",
                labels: {},
              },
              status: {
                conditions: [{ type: "Ready", status: "True" }],
                addresses: [{ type: "InternalIP", address: "192.168.0.241" }],
                allocatable: { cpu: "1", memory: "1Gi" },
                nodeInfo: { kubeletVersion: "v1.36.2+k3s1" },
              },
            },
            {
              metadata: {
                name: "k3s-server",
                labels: { "node-role.kubernetes.io/control-plane": "true" },
              },
              status: {
                conditions: [{ type: "Ready", status: "True" }],
                addresses: [{ type: "InternalIP", address: "192.168.0.240" }],
                allocatable: { cpu: "2", memory: "2Gi" },
                nodeInfo: { kubeletVersion: "v1.36.2+k3s1" },
              },
            },
          ],
        };
      }

      if (url.pathname === "/api/v1/pods") {
        return {
          items: [
            { spec: { nodeName: "k3s-server" } },
            { spec: { nodeName: "k3s-server" } },
            { spec: { nodeName: "k3s-agent-1" } },
          ],
        };
      }

      if (url.pathname === "/apis/metrics.k8s.io") {
        return {
          preferredVersion: { groupVersion: "metrics.k8s.io/v1beta1" },
        };
      }

      if (url.pathname === "/apis/metrics.k8s.io/v1beta1/nodes") {
        return {
          items: [
            {
              metadata: { name: "k3s-agent-1" },
              usage: { cpu: "100m", memory: "512Mi" },
            },
            {
              metadata: { name: "k3s-server" },
              usage: { cpu: "500m", memory: "512Mi" },
            },
          ],
        };
      }

      throw new Error(`Unexpected K3s endpoint: ${url.pathname}`);
    });
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("normalizes per-node CPU, memory, pod counts, and history", async () => {
    const now = Date.parse("2026-08-29T12:00:00.000Z");
    const cluster = await getK3sSnapshot(environment, now);

    expect(cluster).toMatchObject({
      address: "192.168.0.240",
      version: "v1.36.2+k3s1",
      status: "up",
      nodesReady: 2,
      nodesTotal: 2,
      podsTotal: 3,
    });
    expect(cluster.nodes).toMatchObject([
      {
        name: "k3s-server",
        role: "control-plane",
        cpuPercent: 25,
        memoryPercent: 25,
        podCount: 2,
      },
      {
        name: "k3s-agent-1",
        role: "worker",
        cpuPercent: 10,
        memoryPercent: 50,
        podCount: 1,
      },
    ]);
    expect(cluster.nodes[0].cpuHistory).toEqual([[now, 25]]);
    expect(cluster.nodes[0].podHistory).toEqual([[now, 2]]);
  });

  it("uses the configured CA and bearer token for every API request", async () => {
    await getK3sSnapshot(environment);

    expect(requestJson).toHaveBeenCalledTimes(5);
    for (const [, options] of vi.mocked(requestJson).mock.calls) {
      expect(options).toMatchObject({
        headers: { authorization: "Bearer test-token" },
        verifyTls: true,
        ca: "test-ca",
      });
    }
  });
});
