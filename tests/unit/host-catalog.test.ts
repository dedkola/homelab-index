import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  HostCatalogConfigurationError,
  loadHostCatalog,
} from "@/features/dashboard/host-catalog";

const temporaryDirectories: string[] = [];

async function writeCatalog(catalog: unknown): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "homelab-hosts-"));
  const configPath = path.join(directory, "hosts.json");
  temporaryDirectories.push(directory);
  await writeFile(configPath, JSON.stringify(catalog), "utf8");
  return configPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("host catalog", () => {
  it("normalizes TCP and ICMP hosts while ignoring documented examples", async () => {
    const configPath = await writeCatalog({
      version: 1,
      _comment: "Examples are not monitored",
      _examples: [
        {
          id: "example",
          name: "Example",
          host: "example.local",
          check: { type: "icmp" },
        },
      ],
      hosts: [
        {
          id: "home-assistant",
          name: "Home Assistant",
          host: "192.168.10.40",
          check: { type: "tcp", port: 8123 },
          url: "http://192.168.10.40:8123",
        },
        {
          id: "nas-ssh",
          name: "NAS SSH",
          host: "2001:db8::10",
          port: 22,
        },
        {
          id: "backup-server",
          name: "Backup Server",
          host: "192.168.10.41",
          check: { type: "icmp" },
        },
      ],
    });

    await expect(loadHostCatalog(configPath)).resolves.toEqual([
      {
        id: "home-assistant",
        name: "Home Assistant",
        address: "192.168.10.40:8123",
        url: "http://192.168.10.40:8123",
        kind: "host",
        provider: { type: "tcp", host: "192.168.10.40", port: 8123 },
      },
      {
        id: "nas-ssh",
        name: "NAS SSH",
        address: "[2001:db8::10]:22",
        url: undefined,
        kind: "host",
        provider: { type: "tcp", host: "2001:db8::10", port: 22 },
      },
      {
        id: "backup-server",
        name: "Backup Server",
        address: "192.168.10.41",
        url: undefined,
        kind: "host",
        provider: { type: "icmp", host: "192.168.10.41" },
      },
    ]);
  });

  it("rejects duplicate and reserved device ids", async () => {
    const duplicateConfigPath = await writeCatalog({
      version: 1,
      hosts: [
        { id: "nas", name: "NAS", host: "nas.local", port: 22 },
        { id: "nas", name: "NAS HTTPS", host: "nas.local", port: 443 },
      ],
    });
    const reservedConfigPath = await writeCatalog({
      version: 1,
      hosts: [
        {
          id: "k3s-control",
          name: "Control",
          host: "192.168.10.21",
          port: 22,
        },
      ],
    });

    await expect(loadHostCatalog(duplicateConfigPath)).rejects.toBeInstanceOf(
      HostCatalogConfigurationError,
    );
    await expect(
      loadHostCatalog(reservedConfigPath, ["k3s-control"]),
    ).rejects.toBeInstanceOf(HostCatalogConfigurationError);
  });

  it("rejects invalid checks and unknown fields", async () => {
    const configPath = await writeCatalog({
      version: 1,
      hosts: [
        {
          id: "router",
          name: "Router",
          host: "router.local",
          check: { type: "tcp", port: 70_000 },
          typo: true,
        },
      ],
    });

    await expect(loadHostCatalog(configPath)).rejects.toBeInstanceOf(
      HostCatalogConfigurationError,
    );
  });

  it("rejects hosts without a check and ambiguous legacy ports", async () => {
    const missingCheckPath = await writeCatalog({
      version: 1,
      hosts: [{ id: "router", name: "Router", host: "router.local" }],
    });
    const ambiguousCheckPath = await writeCatalog({
      version: 1,
      hosts: [
        {
          id: "router",
          name: "Router",
          host: "router.local",
          port: 443,
          check: { type: "icmp" },
        },
      ],
    });

    await expect(loadHostCatalog(missingCheckPath)).rejects.toBeInstanceOf(
      HostCatalogConfigurationError,
    );
    await expect(loadHostCatalog(ambiguousCheckPath)).rejects.toBeInstanceOf(
      HostCatalogConfigurationError,
    );
  });

  it("re-reads edits without restarting the application", async () => {
    const configPath = await writeCatalog({ version: 1, hosts: [] });

    await expect(loadHostCatalog(configPath)).resolves.toEqual([]);

    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        hosts: [
          {
            id: "router",
            name: "Router",
            host: "router.local",
            check: { type: "tcp", port: 443 },
          },
        ],
      }),
      "utf8",
    );

    await expect(loadHostCatalog(configPath)).resolves.toHaveLength(1);
  });
});
