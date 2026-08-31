# Homelab Index

Next.js 16 App Router dashboard for UniFi, Proxmox, Unraid, K3s, selected LAN workloads, and homelab links.

## Stack

- Next.js 16 App Router and React 19
- Cloudflare Kumo and ECharts
- Typed UniFi, Proxmox REST, and Unraid GraphQL adapters
- Typed Kubernetes API adapter with per-node K3s charts
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

### K3s

Place a kubeconfig named `k3s.config` in the project root, beside `.env`:

```text
homelab-index/
├── .env
├── k3s.config
└── config/
    └── hosts.json
```

`K3S_CONFIG_PATH` defaults to `k3s.config`. The file is read from the server on
every dashboard poll and is excluded from both Git and Docker build contexts.
The K3s card appears after LAN workloads and charts CPU load, memory, and pod
count for every node. CPU and memory come from the cluster Metrics API; pod
counts come from each pod's assigned node.

K3s includes metrics-server unless it was explicitly disabled. Confirm it is
available before connecting the dashboard:

```bash
sudo k3s kubectl get apiservice | grep metrics.k8s.io
sudo k3s kubectl top nodes
```

Do not copy `/etc/rancher/k3s/k3s.yaml` into a permanent deployment. It uses the
unrestricted `system:admin` identity. Create a dedicated read-only identity by
applying this manifest on a K3s server:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: homelab-index
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: homelab-index-reader
  namespace: homelab-index
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: homelab-index-reader
rules:
  - apiGroups: [""]
    resources: ["nodes", "pods"]
    verbs: ["get", "list"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["nodes"]
    verbs: ["get", "list"]
  - nonResourceURLs: ["/version"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: homelab-index-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: homelab-index-reader
subjects:
  - kind: ServiceAccount
    name: homelab-index-reader
    namespace: homelab-index
---
apiVersion: v1
kind: Secret
metadata:
  name: homelab-index-reader-token
  namespace: homelab-index
  annotations:
    kubernetes.io/service-account.name: homelab-index-reader
type: kubernetes.io/service-account-token
```

Save the manifest outside the cluster so it can be reapplied after a reinstall.
Once Kubernetes has populated the Secret, generate the restricted kubeconfig:

```bash
K3S_CA_TEMP=$(mktemp)
K3S_READER_TOKEN=$(sudo k3s kubectl \
  --namespace homelab-index \
  get secret homelab-index-reader-token \
  --output jsonpath='{.data.token}' | base64 --decode)

sudo k3s kubectl \
  --namespace homelab-index \
  get secret homelab-index-reader-token \
  --output jsonpath='{.data.ca\.crt}' | base64 --decode > "$K3S_CA_TEMP"

sudo k3s kubectl config set-cluster k3s \
  --kubeconfig k3s.config \
  --server https://192.168.0.240:6443 \
  --certificate-authority "$K3S_CA_TEMP" \
  --embed-certs=true
sudo k3s kubectl config set-credentials homelab-index-reader \
  --kubeconfig k3s.config \
  --token "$K3S_READER_TOKEN"
sudo k3s kubectl config set-context homelab-index \
  --kubeconfig k3s.config \
  --cluster k3s \
  --user homelab-index-reader
sudo k3s kubectl config use-context homelab-index \
  --kubeconfig k3s.config

chmod 600 k3s.config
rm -f "$K3S_CA_TEMP"
unset K3S_READER_TOKEN
```

Keep the K3s API on the trusted LAN, make `192.168.0.240` a stable address, and
include that address under `tls-san` in `/etc/rancher/k3s/config.yaml`. A fresh
cluster has a new CA and token, so after reinstalling, reapply the saved RBAC
manifest and replace `k3s.config`. The dashboard picks up the replacement on its
next poll.

## Devices and links

Quick links remain in `src/config/dashboard.ts`. LAN workloads come only from
TCP- or ICMP-monitored hosts in `config/hosts.json`:

```json
{
  "version": 1,
  "hosts": [
    {
      "id": "home-assistant",
      "name": "Home Assistant",
      "host": "192.168.10.40",
      "check": { "type": "tcp", "port": 8123 },
      "url": "http://192.168.10.40:8123"
    },
    {
      "id": "backup-server",
      "name": "Backup Server",
      "host": "192.168.10.11",
      "check": { "type": "icmp" }
    }
  ]
}
```

`id`, `name`, `host`, and `check` are required. `url` is optional and adds the
card's open button. Use a hostname or IP address without a URL scheme for
`host`; TCP ports must be between `1` and `65535`. The legacy top-level `port`
field remains supported as a TCP check for existing catalogs.

TCP checks report `Up` when the configured port accepts a connection. ICMP
checks report `Up` when the host answers one ping; firewalls that block ICMP
will make an otherwise running host appear down. The file is validated and
re-read on every dashboard poll. Invalid catalogs degrade the devices source
while the provider-backed cards remain available. Host cards never fabricate
CPU, memory, or uptime values.

Set `HOSTS_CONFIG_PATH` only when the catalog is stored somewhere other than
`config/hosts.json`. Placeholder glyphs remain intentional until final service
icons are selected.

## Docker Compose

```bash
cp .env.example .env
chgrp 1001 k3s.config
chmod 640 k3s.config
docker compose up -d --build
```

The group-readable mode lets the container's non-root `nextjs` user (GID 1001)
read the mounted kubeconfig without making it world-readable. The container
exposes a health check at `/api/health`.

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

Create `/mnt/user/appdata/homelab-index/hosts.json` using the catalog format
above. Add a **Path** with container path `/app/config/hosts.json`, host path
`/mnt/user/appdata/homelab-index/hosts.json`, and read-only access. Catalog
edits are picked up by the next dashboard poll.

Place the restricted kubeconfig at
`/mnt/user/appdata/homelab-index/k3s.config`, beside `.env`, and protect it:

```bash
chown root:1001 /mnt/user/appdata/homelab-index/k3s.config
chmod 640 /mnt/user/appdata/homelab-index/k3s.config
```

Select **Add another Path, Port, Variable, Label or Device**, choose **Path**,
and configure the K3s file exactly as follows:

1. Host path: `/mnt/user/appdata/homelab-index/k3s.config`
2. Container path: `/app/k3s.config`
3. Access mode: **Read Only**

The default `K3S_CONFIG_PATH=k3s.config` resolves to this mounted file. Click
**Apply** after adding or changing the path so Unraid recreates the container
with the mount; rebuilding the image is not required.

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

In the Unraid container editor, enable **Advanced View** and add this value to
**Extra Parameters**:

```text
--env-file /mnt/user/appdata/homelab-index/.env
```

Click **Apply** to recreate the container after adding the parameter or changing
the `.env` file. When using `--env-file`, the same keys do not also need to be
added individually as Unraid template variables.

The equivalent Unraid terminal command is:

```bash
docker pull ghcr.io/dedkola/homelab-index:latest

docker run -d \
  --name homelab-index \
  --restart unless-stopped \
  --env-file /mnt/user/appdata/homelab-index/.env \
  --mount type=bind,src=/mnt/user/appdata/homelab-index/hosts.json,dst=/app/config/hosts.json,readonly \
  --mount type=bind,src=/mnt/user/appdata/homelab-index/k3s.config,dst=/app/k3s.config,readonly \
  -p 3000:3000 \
  ghcr.io/dedkola/homelab-index:latest
```

Open `http://<unraid-ip>:3000`.

## Deploy on Proxmox

Run the image inside a small Debian or Ubuntu Docker VM. Do not install Docker
directly on the Proxmox VE host. Inside the VM, create this deployment folder:

```text
/opt/homelab-index/
├── config/
│   └── hosts.json
├── compose.yaml
├── k3s.config
└── .env
```

Create `.env` from `.env.example`, insert the real provider values, and protect
the file:

```bash
chmod 600 /opt/homelab-index/.env
chown root:1001 /opt/homelab-index/k3s.config
chmod 640 /opt/homelab-index/k3s.config
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
    volumes:
      - ./config/hosts.json:/app/config/hosts.json:ro
      - ./k3s.config:/app/k3s.config:ro
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

`k3s.config` must likewise use the K3s server's LAN address, not `localhost`.

The container must be able to route to provider addresses and every monitored
host or `host:port`. Keep port `3000` LAN-only or protect it with an
authenticated reverse proxy. After changing `.env`, recreate the container so
the application reads the new values. Mounted `hosts.json` edits need no restart
and appear on the next poll. If the catalog is maintained in GitHub, update the
checked-out file on the Docker host; restarting an image without updating its
mounted file does not fetch repository changes.

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
config/hosts.json                 Runtime TCP and ICMP host catalog
k3s.config                        Ignored runtime Kubernetes credentials
src/config/dashboard.ts           Quick links
src/features/dashboard/          Domain model, providers, history, orchestration
src/lib/                         Environment, HTTP, and formatting utilities
tests/unit/                       Pure unit tests
tests/integration/                Provider and snapshot contract tests
tests/e2e/                        4K browser smoke coverage
```
