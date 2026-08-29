import "server-only";

import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const runtimeEnvironmentSchema = z.object({
  DASHBOARD_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(300_000)
    .default(30_000),
  PROVIDER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .default(8_000),
  HOSTS_CONFIG_PATH: z.string().min(1).default("config/hosts.json"),
  K3S_CONFIG_PATH: z.string().min(1).default("k3s.config"),
  PROXMOX_API_URL: z.string().url().optional(),
  PROXMOX_NODE: z.string().min(1).optional(),
  PROXMOX_TOKEN_ID: z.string().min(1).optional(),
  PROXMOX_TOKEN_SECRET: z.string().min(1).optional(),
  PROXMOX_VERIFY_TLS: booleanString,
  UNRAID_GRAPHQL_URL: z.string().url().optional(),
  UNRAID_API_KEY: z.string().min(1).optional(),
  UNRAID_NETWORK_INTERFACE: z.string().min(1).optional(),
  UNRAID_VERIFY_TLS: booleanString,
  UNIFI_API_URL: z.string().url().optional(),
  UNIFI_API_KEY: z.string().min(1).optional(),
  UNIFI_SITE_ID: z.string().min(1).optional(),
  UNIFI_GATEWAY_ID: z.string().min(1).optional(),
  UNIFI_VERIFY_TLS: booleanString,
  UNIFI_SITE_MANAGER_API_URL: z.string().url().default("https://api.ui.com"),
  UNIFI_SITE_MANAGER_API_KEY: z.string().min(1).optional(),
  UNIFI_SITE_MANAGER_SITE_ID: z.string().min(1).optional(),
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

let cachedEnvironment: RuntimeEnvironment | undefined;

export function getRuntimeEnvironment(): RuntimeEnvironment {
  if (!cachedEnvironment) {
    cachedEnvironment = runtimeEnvironmentSchema.parse(process.env);
  }

  return cachedEnvironment;
}

export function resetRuntimeEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
