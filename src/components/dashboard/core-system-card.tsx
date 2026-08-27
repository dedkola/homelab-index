"use client";

import { Badge, ChartLegend, LayerCard, Text } from "@cloudflare/kumo";

import { MetricChart } from "@/components/dashboard/metric-chart";
import type { CoreSystem } from "@/features/dashboard/types";
import {
  formatBytes,
  formatBytesPerSecond,
  formatDuration,
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

function peak(points: [number, number][]): number {
  return points.reduce((highest, [, value]) => Math.max(highest, value), 0);
}

export function CoreSystemCard({ system }: CoreSystemCardProps) {
  const networkRate = formatBytesPerSecond(
    system.network.rxBytesPerSecond + system.network.txBytesPerSecond,
  );
  const networkTotal =
    system.network.totalRxBytes + system.network.totalTxBytes;
  const freeMemory = Math.max(
    0,
    system.memory.totalBytes - system.memory.usedBytes,
  );
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
            {system.id === "proxmox" ? "PX" : "UR"}
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
                {system.cpu.threads} threads
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
          value={system.cpu.percent.toFixed(1)}
          unit="%"
          detail={
            <>
              {system.cpu.cores} cores
              <br />
              {system.cpu.threads} threads
            </>
          }
          series={[
            { name: "CPU", color: COLORS.orange, data: system.cpu.history },
          ]}
          footer={
            <>
              <span>24h</span>
              <span>Peak {peak(system.cpu.history).toFixed(1)}%</span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(1)}%`}
        />

        <MetricChart
          label="Memory"
          value={system.memory.percent.toFixed(1)}
          unit="%"
          detail={
            <>
              {formatBytes(system.memory.usedBytes)}
              <br />
              {formatBytes(system.memory.totalBytes)}
            </>
          }
          series={[
            { name: "Memory", color: COLORS.blue, data: system.memory.history },
          ]}
          footer={
            <>
              <span>24h</span>
              <span>Free {formatBytes(freeMemory)}</span>
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
              {formatBytes(networkTotal)}
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
                    formatBytesPerSecond(system.network.rxBytesPerSecond).value
                  }
                />
                <ChartLegend.SmallItem
                  name="Out"
                  color={COLORS.purple}
                  value={
                    formatBytesPerSecond(system.network.txBytesPerSecond).value
                  }
                />
              </div>
              <span>24h</span>
            </>
          }
          tooltipValueFormat={(value) => {
            const formatted = formatBytesPerSecond(value);
            return `${formatted.value} ${formatted.unit}`;
          }}
        />
      </LayerCard.Primary>
    </LayerCard>
  );
}
