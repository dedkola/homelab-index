"use client";

import { Badge, ChartLegend, LayerCard, Text } from "@cloudflare/kumo";

import { MetricChart } from "@/components/dashboard/metric-chart";
import { SystemLogo } from "@/components/dashboard/system-logo";
import type { UniFiNetwork } from "@/features/dashboard/types";
import {
  formatBytesPerSecond,
  formatDuration,
  formatMegabitsPerSecond,
} from "@/lib/format";

const COLORS = {
  orange: "#f48120",
  blue: "#0f61d8",
  green: "#16864b",
  purple: "#7259c9",
} as const;

interface UniFiNetworkCardProps {
  network: UniFiNetwork;
}

function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function count(value: number | null): string {
  return value === null ? "—" : value.toString();
}

function rate(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const formatted = formatBytesPerSecond(value);
  return `${formatted.value} ${formatted.unit}`;
}

function capacity(kilobitsPerSecond: number | null): string {
  if (kilobitsPerSecond === null) {
    return "—";
  }

  return rate((kilobitsPerSecond * 1_000) / 8);
}

function nullableFixed(value: number | null, digits = 0): string {
  return value === null ? "—" : value.toFixed(digits);
}

export function UniFiNetworkCard({ network }: UniFiNetworkCardProps) {
  const totalTraffic =
    network.traffic.rxBytesPerSecond === null ||
    network.traffic.txBytesPerSecond === null
      ? null
      : network.traffic.rxBytesPerSecond + network.traffic.txBytesPerSecond;
  const formattedTotalTraffic =
    totalTraffic === null
      ? { value: "—", unit: "" }
      : formatBytesPerSecond(totalTraffic);
  const hasInternetIssue = network.internetIssueCount > 0;
  const statusVariant =
    network.status === "down"
      ? "error"
      : hasInternetIssue
        ? "warning"
        : network.status === "up"
          ? "success"
          : "neutral";
  const statusLabel =
    network.status === "down"
      ? "Down"
      : hasInternetIssue
        ? "Internet issue"
        : network.status === "up"
          ? "Online"
          : "Unknown";

  return (
    <LayerCard className="network-system-card system-unifi">
      <LayerCard.Secondary className="system-header network-system-header">
        <div className="system-identity">
          <div className="system-glyph" aria-hidden="true">
            <SystemLogo id="unifi" />
          </div>
          <div className="system-copy">
            <div className="system-title-row">
              <Text as="h3" variant="heading">
                {network.name}
              </Text>
              <Badge variant={statusVariant} appearance="dot">
                {statusLabel}
              </Badge>
            </div>
            <div className="system-subline network-system-subline">
              <Text as="span" variant="mono-secondary">
                {network.address}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                {network.model}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                FW {network.firmwareVersion}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                Network {network.applicationVersion}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                CPU {percent(network.cpuPercent)}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                RAM {percent(network.memoryPercent)}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                Load {nullableFixed(network.loadAverage1Min, 2)}
              </Text>
            </div>
          </div>
        </div>
        <div className="system-uptime">
          <span className="micro-label">Uptime</span>
          <Text as="span" variant="mono">
            {formatDuration(network.uptimeSeconds)}
          </Text>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="system-metrics">
        <MetricChart
          label="WAN traffic"
          value={formattedTotalTraffic.value}
          unit={formattedTotalTraffic.unit}
          detail={
            <>
              ↓ {rate(network.traffic.rxBytesPerSecond)}
              <br />↑ {rate(network.traffic.txBytesPerSecond)}
            </>
          }
          series={[
            {
              name: "Down",
              color: COLORS.green,
              data: network.traffic.rxHistory,
            },
            {
              name: "Up",
              color: COLORS.purple,
              data: network.traffic.txHistory,
            },
          ]}
          footer={
            <>
              <div className="network-legend">
                <ChartLegend.SmallItem
                  name="Down"
                  color={COLORS.green}
                  value={rate(network.traffic.rxBytesPerSecond)}
                />
                <ChartLegend.SmallItem
                  name="Up"
                  color={COLORS.purple}
                  value={rate(network.traffic.txBytesPerSecond)}
                />
              </div>
              <span>
                {count(network.devices.wanCount)} WAN · ↓{" "}
                {capacity(network.internet.downloadKbps)} · ↑{" "}
                {capacity(network.internet.uploadKbps)}
              </span>
            </>
          }
          yAxisTickFormat={formatMegabitsPerSecond}
          tooltipValueFormat={(value) => rate(value)}
        />

        <MetricChart
          label="Internet quality"
          value={nullableFixed(network.internet.averageLatencyMs)}
          unit={network.internet.averageLatencyMs === null ? "" : "ms"}
          detail={
            <>
              Max {nullableFixed(network.internet.maximumLatencyMs)} ms
              <br />
              {network.internet.ispAsn ? `AS${network.internet.ispAsn}` : "—"}
            </>
          }
          series={[
            {
              name: "Average",
              color: COLORS.orange,
              data: network.internet.latencyHistory,
            },
            {
              name: "Maximum",
              color: COLORS.blue,
              data: network.internet.maximumLatencyHistory,
            },
          ]}
          footer={
            <>
              <span
                className="network-isp"
                title={network.internet.ispName ?? undefined}
              >
                {network.internet.ispName ?? "ISP unavailable"}
              </span>
              <span>
                Loss {percent(network.internet.packetLossPercent)} · Up{" "}
                {percent(network.internet.uptimePercent)}
              </span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(0)} ms`}
        />

        <MetricChart
          label="Clients"
          value={count(network.clients.total)}
          unit=""
          detail={
            <>
              {count(network.clients.wired)} wired
              <br />
              {count(network.clients.wireless)} Wi-Fi
            </>
          }
          series={[
            {
              name: "Clients",
              color: COLORS.green,
              data: network.clients.history,
            },
          ]}
          footer={
            <>
              <span>
                {count(network.devices.online)}/{count(network.devices.total)}{" "}
                devices · {count(network.devices.portsUp)}/
                {count(network.devices.portsTotal)} ports
              </span>
              <span>
                {count(network.devices.pendingUpdates)} updates ·{" "}
                {count(network.clients.guest)} guests
              </span>
            </>
          }
          tooltipValueFormat={(value) => `${Math.round(value)} clients`}
        />
      </LayerCard.Primary>
    </LayerCard>
  );
}
