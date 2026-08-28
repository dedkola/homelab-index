import "server-only";

import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

import { z } from "zod";

import type { LanDeviceDefinition } from "@/features/dashboard/types";

const HOST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

function isHostname(value: string): boolean {
  if (isIP(value) !== 0) {
    return true;
  }

  const hostname = value.endsWith(".") ? value.slice(0, -1) : value;

  return (
    hostname.length > 0 &&
    hostname.length <= 253 &&
    hostname.split(".").every((label) => HOSTNAME_LABEL_PATTERN.test(label))
  );
}

function isHttpUrl(value: string): boolean {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

const monitoredHostSchema = z
  .object({
    id: z.string().trim().min(1).max(64).regex(HOST_ID_PATTERN),
    name: z.string().trim().min(1).max(80),
    host: z.string().trim().min(1).max(253).refine(isHostname, {
      message: "Must be a valid IP address or hostname",
    }),
    port: z.number().int().min(1).max(65_535),
    url: z
      .string()
      .url()
      .refine(isHttpUrl, {
        message: "Must use the http or https protocol",
      })
      .optional(),
  })
  .strict();

const hostCatalogSchema = z
  .object({
    version: z.literal(1),
    hosts: z.array(monitoredHostSchema).max(128),
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>();

    catalog.hosts.forEach((host, index) => {
      if (ids.has(host.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate host id: ${host.id}`,
          path: ["hosts", index, "id"],
        });
      }

      ids.add(host.id);
    });
  });

export class HostCatalogConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HostCatalogConfigurationError";
  }
}

function formatHostAndPort(host: string, port: number): string {
  return `${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
}

export async function loadHostCatalog(
  configPath: string,
  reservedIds: Iterable<string> = [],
): Promise<LanDeviceDefinition[]> {
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    configPath,
  );

  try {
    const source = await readFile(absolutePath, "utf8");
    const catalog = hostCatalogSchema.parse(JSON.parse(source));
    const usedIds = new Set(reservedIds);

    for (const host of catalog.hosts) {
      if (usedIds.has(host.id)) {
        throw new HostCatalogConfigurationError(
          `Host id conflicts with an existing dashboard device: ${host.id}`,
        );
      }

      usedIds.add(host.id);
    }

    return catalog.hosts.map((host) => ({
      id: host.id,
      name: host.name,
      address: formatHostAndPort(host.host, host.port),
      url: host.url,
      kind: "host",
      provider: { type: "tcp", host: host.host, port: host.port },
    }));
  } catch (error) {
    if (error instanceof HostCatalogConfigurationError) {
      throw error;
    }

    throw new HostCatalogConfigurationError(
      `Unable to load host catalog at ${absolutePath}`,
      { cause: error },
    );
  }
}
