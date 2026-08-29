import "server-only";

import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

import { z } from "zod";

import type { LanDeviceDefinition } from "@/features/dashboard/types";

const HOST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOSTNAME_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;
const portSchema = z.number().int().min(1).max(65_535);

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

const hostCheckSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tcp"), port: portSchema }).strict(),
  z.object({ type: z.literal("icmp") }).strict(),
]);

const monitoredHostSchema = z
  .object({
    id: z.string().trim().min(1).max(64).regex(HOST_ID_PATTERN),
    name: z.string().trim().min(1).max(80),
    host: z.string().trim().min(1).max(253).refine(isHostname, {
      message: "Must be a valid IP address or hostname",
    }),
    check: hostCheckSchema.optional(),
    port: portSchema.optional(),
    url: z
      .string()
      .url()
      .refine(isHttpUrl, {
        message: "Must use the http or https protocol",
      })
      .optional(),
  })
  .strict()
  .superRefine((host, context) => {
    if (!host.check && host.port === undefined) {
      context.addIssue({
        code: "custom",
        message: "Must define check or legacy port",
        path: ["check"],
      });
    }

    if (host.check && host.port !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Use check.port instead of combining check with legacy port",
        path: ["port"],
      });
    }
  })
  .transform(({ port, ...host }) => ({
    ...host,
    check: host.check ?? { type: "tcp" as const, port: port as number },
  }));

const hostCatalogSchema = z
  .object({
    version: z.literal(1),
    _comment: z.string().max(240).optional(),
    _examples: z.array(monitoredHostSchema).max(8).optional(),
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

    return catalog.hosts.map((host) => {
      const provider =
        host.check.type === "tcp"
          ? {
              type: "tcp" as const,
              host: host.host,
              port: host.check.port,
            }
          : { type: "icmp" as const, host: host.host };

      return {
        id: host.id,
        name: host.name,
        address:
          provider.type === "tcp"
            ? formatHostAndPort(provider.host, provider.port)
            : provider.host,
        url: host.url,
        kind: "host",
        provider,
      };
    });
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
