import type { QuickLink } from "@/features/dashboard/types";

export const dashboardCatalog = {
  links: [
    {
      id: "grafana",
      name: "Grafana",
      url: "https://grafana.local",
    },
    {
      id: "adguard",
      name: "AdGuard",
      url: "https://adguard.local",
    },
    {
      id: "home-assistant",
      name: "Home Assistant",
      url: "https://home.local",
    },
    {
      id: "portainer",
      name: "Portainer",
      url: "https://portainer.local",
    },
    { id: "git", name: "Git", url: "https://git.local" },
    {
      id: "uptime-kuma",
      name: "Uptime Kuma",
      url: "https://uptime.local",
    },
    { id: "vault", name: "Vault", url: "https://vault.local" },
    { id: "files", name: "Files", url: "https://files.local" },
    { id: "router", name: "Router", url: "https://router.local" },
    {
      id: "cloudflare",
      name: "Cloudflare",
      url: "https://dash.cloudflare.com",
    },
  ] satisfies QuickLink[],
} as const;
