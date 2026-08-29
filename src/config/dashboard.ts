import type { QuickLink } from "@/features/dashboard/types";

export const dashboardCatalog = {
  links: [
    {
      id: "grafana",
      name: "Grafana",
      url: "https://grafana.local",
      glyph: "GF",
    },
    {
      id: "adguard",
      name: "AdGuard",
      url: "https://adguard.local",
      glyph: "AG",
    },
    {
      id: "home-assistant",
      name: "Home Assistant",
      url: "https://home.local",
      glyph: "HA",
    },
    {
      id: "portainer",
      name: "Portainer",
      url: "https://portainer.local",
      glyph: "PT",
    },
    { id: "git", name: "Git", url: "https://git.local", glyph: "GT" },
    {
      id: "uptime-kuma",
      name: "Uptime Kuma",
      url: "https://uptime.local",
      glyph: "UK",
    },
    { id: "vault", name: "Vault", url: "https://vault.local", glyph: "VB" },
    { id: "files", name: "Files", url: "https://files.local", glyph: "FS" },
    { id: "router", name: "Router", url: "https://router.local", glyph: "RT" },
    {
      id: "cloudflare",
      name: "Cloudflare",
      url: "https://dash.cloudflare.com",
      glyph: "CF",
    },
  ] satisfies QuickLink[],
} as const;
