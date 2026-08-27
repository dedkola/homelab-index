# Homelab Index

Next.js 16 App Router dashboard for Proxmox, Unraid, selected LAN workloads, and homelab links.

## Stack

- Next.js 16 App Router and React 19
- Cloudflare Kumo and ECharts
- Typed Proxmox REST and Unraid GraphQL adapters
- Vitest and Playwright
- Docker standalone output

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Mock mode is enabled by default and requires no homelab access. Open [http://localhost:3000](http://localhost:3000).

## Live data

Set `DASHBOARD_MODE=live` in `.env` and configure both providers.

### Proxmox

Create a read-only API token and grant it an audit role for the node and selected VMs.

```dotenv
PROXMOX_API_URL=https://192.168.10.10:8006
PROXMOX_NODE=pve
PROXMOX_TOKEN_ID=homelab-index@pve!dashboard
PROXMOX_TOKEN_SECRET=replace-me
PROXMOX_VERIFY_TLS=false
```

The adapter reads node status, 24-hour RRD data, and VM resources. VM IDs are matched to the selected cards in `src/config/dashboard.ts`.

### Unraid

Unraid 7.2 and newer include the GraphQL API. Create a read-only API key under Settings → Management Access → API Keys.

```dotenv
UNRAID_GRAPHQL_URL=http://192.168.10.11/graphql
UNRAID_API_KEY=replace-me
UNRAID_NETWORK_INTERFACE=br0
UNRAID_VERIFY_TLS=true
```

Unraid CPU, memory, and network history accumulates while the application is running. Proxmox history comes directly from RRD.

## Devices and links

Edit `src/config/dashboard.ts` to choose LAN workloads, Proxmox VM IDs, IP addresses, URLs, and quick links. Placeholder glyphs are intentional until final service icons are selected.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

The container runs as a non-root user and exposes a health check at `/api/health`.

## Quality commands

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:smoke
pnpm build
pnpm check
```

Install the Playwright browser once before smoke tests:

```bash
pnpm exec playwright install chromium
```

## Project structure

```text
src/app/                         App Router pages and route handlers
src/components/dashboard/        Kumo dashboard UI
src/config/dashboard.ts          Selected devices and quick links
src/features/dashboard/          Domain model, providers, history, orchestration
src/lib/                         Environment, HTTP, and formatting utilities
tests/unit/                       Pure unit tests
tests/integration/                Provider and snapshot contract tests
tests/e2e/                        4K browser smoke coverage
prototype/index.html              Approved visual reference
```
