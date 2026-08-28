"use client";

import { Badge, ChartLegend, LayerCard, Text } from "@cloudflare/kumo";

import { MetricChart } from "@/components/dashboard/metric-chart";
import { SystemLogo } from "@/components/dashboard/system-logo";
import type { CoreSystem } from "@/features/dashboard/types";
import {
  formatBytes,
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

interface CoreSystemCardProps {
  system: CoreSystem;
}

function peak(points: [number, number][]): number | null {
  return points.length === 0
    ? null
    : points.reduce((highest, [, value]) => Math.max(highest, value), 0);
}

export function CoreSystemCard({ system }: CoreSystemCardProps) {
  const cpuPeak = peak(system.cpu.history);
  const { rxBytesPerSecond, txBytesPerSecond } = system.network;
  const networkRate =
    rxBytesPerSecond !== null && txBytesPerSecond !== null
      ? formatBytesPerSecond(rxBytesPerSecond + txBytesPerSecond)
      : { value: "—", unit: "" };
  const networkTotal =
    system.network.totalRxBytes === null || system.network.totalTxBytes === null
      ? null
      : system.network.totalRxBytes + system.network.totalTxBytes;
  const freeMemory =
    system.memory.totalBytes === null || system.memory.usedBytes === null
      ? null
      : Math.max(0, system.memory.totalBytes - system.memory.usedBytes);
  const statusVariant =
    system.status === "up"
      ? "success"
      : system.status === "down"
        ? "error"
        : "neutral";

  return (
    <LayerCard className={`core-system-card system-${system.id}`}>
      <LayerCard.Secondary className="system-header">
        <div className="system-identity">
          <div className="system-glyph" aria-hidden="true">
            <SystemLogo id={system.id} />
          </div>
          <div className="system-copy">
            <div className="system-title-row">
              <Text as="h3" variant="heading">
                {system.name}
              </Text>
              <Badge variant={statusVariant} appearance="dot">
                {system.status === "up" ? "Online" : system.status}
              </Badge>
            </div>
            <div className="system-subline">
              <Text as="span" variant="mono-secondary">
                {system.address}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                {system.version}
              </Text>
              <span>/</span>
              <Text as="span" variant="mono-secondary">
                {system.cpu.threads === null
                  ? "—"
                  : `${system.cpu.threads} threads`}
              </Text>
            </div>
          </div>
        </div>
        <div className="system-uptime">
          <span className="micro-label">Uptime</span>
          <Text as="span" variant="mono">
            {formatDuration(system.uptimeSeconds)}
          </Text>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="system-metrics">
        <MetricChart
          label="CPU load"
          value={
            system.cpu.percent === null ? "—" : system.cpu.percent.toFixed(1)
          }
          unit={system.cpu.percent === null ? "" : "%"}
          detail={
            system.cpu.cores === null || system.cpu.threads === null ? (
              "—"
            ) : (
              <>
                {system.cpu.cores} cores
                <br />
                {system.cpu.threads} threads
              </>
            )
          }
          series={[
            { name: "CPU", color: COLORS.orange, data: system.cpu.history },
          ]}
          footer={
            <>
              <span>{system.cpu.history.length > 0 ? "24h" : "No data"}</span>
              <span>
                Peak {cpuPeak === null ? "—" : `${cpuPeak.toFixed(1)}%`}
              </span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(1)}%`}
        />

        <MetricChart
          label="Memory"
          value={
            system.memory.percent === null
              ? "—"
              : system.memory.percent.toFixed(1)
          }
          unit={system.memory.percent === null ? "" : "%"}
          detail={
            system.memory.usedBytes === null ||
            system.memory.totalBytes === null ? (
              "—"
            ) : (
              <>
                {formatBytes(system.memory.usedBytes)}
                <br />
                {formatBytes(system.memory.totalBytes)}
              </>
            )
          }
          series={[
            { name: "Memory", color: COLORS.blue, data: system.memory.history },
          ]}
          footer={
            <>
              <span>
                {system.memory.history.length > 0 ? "24h" : "No data"}
              </span>
              <span>
                Free {freeMemory === null ? "—" : formatBytes(freeMemory)}
              </span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(1)}%`}
        />

        <MetricChart
          label="Network"
          value={networkRate.value}
          unit={networkRate.unit}
          detail={
            <>
              {networkTotal === null ? "—" : formatBytes(networkTotal)}
              <br />
              total
            </>
          }
          series={[
            { name: "In", color: COLORS.green, data: system.network.rxHistory },
            {
              name: "Out",
              color: COLORS.purple,
              data: system.network.txHistory,
            },
          ]}
          footer={
            <>
              <div className="network-legend">
                <ChartLegend.SmallItem
                  name="In"
                  color={COLORS.green}
                  value={
                    system.network.rxBytesPerSecond === null
                      ? "—"
                      : formatBytesPerSecond(system.network.rxBytesPerSecond)
                          .value
                  }
                />
                <ChartLegend.SmallItem
                  name="Out"
                  color={COLORS.purple}
                  value={
                    system.network.txBytesPerSecond === null
                      ? "—"
                      : formatBytesPerSecond(system.network.txBytesPerSecond)
                          .value
                  }
                />
              </div>
              <span>
                {system.network.rxHistory.length > 0 ||
                system.network.txHistory.length > 0
                  ? "24h"
                  : "No data"}
              </span>
            </>
          }
          yAxisTickFormat={formatMegabitsPerSecond}
          tooltipValueFormat={(value) => {
            const formatted = formatBytesPerSecond(value);
            return `${formatted.value} ${formatted.unit}`;
          }}
        />
      </LayerCard.Primary>
    </LayerCard>
  );
}
