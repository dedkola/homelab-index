# Homelab Index

Next.js 16 App Router dashboard for UniFi, Proxmox, Unraid, selected LAN workloads, and homelab links.

## Stack

- Next.js 16 App Router and React 19
- Cloudflare Kumo and ECharts
- Typed UniFi, Proxmox REST, and Unraid GraphQL adapters
- Vitest and Playwright
- Docker standalone output

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Configure the provider values in `.env`, then open [http://localhost:3000](http://localhost:3000). The dashboard always requests live provider data; missing or unreachable providers are shown as degraded.

## Provider configuration

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

### UniFi

Create a local API key in UniFi Network under Control Plane → Integrations. The local API supplies current gateway utilization, uplink traffic, clients, devices, ports, and WAN definitions.

Create a separate Site Manager API key at [unifi.ui.com](https://unifi.ui.com) for 24-hour ISP latency, packet loss, uptime, and provisioned download/upload capacity.

```dotenv
UNIFI_API_URL=https://192.168.0.1/proxy/network/integration
UNIFI_API_KEY=replace-me
UNIFI_VERIFY_TLS=false

UNIFI_SITE_MANAGER_API_URL=https://api.ui.com
UNIFI_SITE_MANAGER_API_KEY=replace-me
```

Both keys remain server-only. The local and Site Manager sources degrade independently, so the Network card continues to show whichever telemetry remains available. Set `UNIFI_SITE_ID`, `UNIFI_GATEWAY_ID`, or `UNIFI_SITE_MANAGER_SITE_ID` only when automatic selection is ambiguous.

## Devices and links

Edit `src/config/dashboard.ts` to choose LAN workloads, Proxmox VM IDs, IP addresses, URLs, and quick links. Placeholder glyphs are intentional until final service icons are selected.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

The container runs as a non-root user and exposes a health check at `/api/health`.

## Published container image

Pushes to `main` publish a multi-platform image for `linux/amd64` and
`linux/arm64` to GitHub Container Registry:

```bash
docker pull ghcr.io/dedkola/homelab-index:latest
```

## Deploy on Unraid

In the Unraid WebGUI, open **Docker**, select **Add Container**, and configure:

- Repository: `ghcr.io/dedkola/homelab-index:latest`
- Network type: `bridge`
- Container port: `3000`
- Host port: `3000`

For each non-commented key in `.env.example`, select
**Add another Path, Port, Variable, Label or Device**, choose **Variable**, and
enter the key and its real value. Unraid stores these values in the container
template, so a separate `.env` file is not required with this method.

To use an actual environment file instead, create it from `.env.example` in a
protected app-data directory using the Unraid terminal:

```bash
mkdir -p /mnt/user/appdata/homelab-index
chmod 700 /mnt/user/appdata/homelab-index
nano /mnt/user/appdata/homelab-index/.env
chmod 600 /mnt/user/appdata/homelab-index/.env
```

Then start the published image with that file:

```bash
docker pull ghcr.io/dedkola/homelab-index:latest

docker run -d \
  --name homelab-index \
  --restart unless-stopped \
  --env-file /mnt/user/appdata/homelab-index/.env \
  -p 3000:3000 \
  ghcr.io/dedkola/homelab-index:latest
```

Open `http://<unraid-ip>:3000`.

## Deploy on Proxmox

Run the image inside a small Debian or Ubuntu Docker VM. Do not install Docker
directly on the Proxmox VE host. Inside the VM, create this deployment folder:

```text
/opt/homelab-index/
├── compose.yaml
└── .env
```

Create `.env` from `.env.example`, insert the real provider values, and protect
the file:

```bash
chmod 600 /opt/homelab-index/.env
```

Use this `/opt/homelab-index/compose.yaml`:

```yaml
services:
  homelab-index:
    image: ghcr.io/dedkola/homelab-index:latest
    container_name: homelab-index
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
```

Start it from the deployment directory:

```bash
cd /opt/homelab-index
docker compose pull
docker compose up -d
```

Open `http://<docker-vm-ip>:3000`.

Inside a container, `localhost` points to the dashboard container itself. Use
the providers' LAN addresses in `.env`, for example:

```dotenv
PROXMOX_API_URL=https://<proxmox-ip>:8006
UNRAID_GRAPHQL_URL=http://<unraid-ip>/graphql
UNIFI_API_URL=https://<unifi-ip>/proxy/network/integration
```

The container must be able to route to those addresses. Keep port `3000`
LAN-only or protect it with an authenticated reverse proxy. After changing
`.env`, recreate the container so the application reads the new values.

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
```
