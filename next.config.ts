import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Only initialize the local Cloudflare dev platform when running `next dev`.
// This avoids spawning workerd during `next build` (e.g. inside Docker),
// where the alpine/musl environment cannot run the glibc workerd binary.
if (process.argv.includes("dev")) {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
