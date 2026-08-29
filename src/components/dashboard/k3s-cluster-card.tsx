"use client";

import { Badge, ChartLegend, LayerCard, Text } from "@cloudflare/kumo";

import { MetricChart } from "@/components/dashboard/metric-chart";
import { SystemLogo } from "@/components/dashboard/system-logo";
import type { K3sCluster, K3sNode } from "@/features/dashboard/types";
import { formatBytes } from "@/lib/format";

const NODE_COLORS = ["#f48120", "#0f61d8", "#16864b", "#7259c9"] as const;

interface K3sClusterCardProps {
  cluster: K3sCluster;
}

type NodeValue = (node: K3sNode) => number | null;

function valueOrDash(
  value: number | null,
  suffix: string,
  fractionDigits: number,
): string {
  return value === null ? "—" : `${value.toFixed(fractionDigits)}${suffix}`;
}

function NodeLegend({
  nodes,
  value,
  suffix = "",
  fractionDigits = 1,
}: {
  nodes: K3sNode[];
  value: NodeValue;
  suffix?: string;
  fractionDigits?: number;
}) {
  return (
    <div className="node-series-legend">
      {nodes.map((node, index) => (
        <ChartLegend.SmallItem
          key={node.name}
          name={node.name}
          color={NODE_COLORS[index % NODE_COLORS.length]}
          value={valueOrDash(value(node), suffix, fractionDigits)}
        />
      ))}
    </div>
  );
}

function historyLabel(nodes: K3sNode[]): string {
  return nodes.some(
    (node) =>
      node.cpuHistory.length > 1 ||
      node.memoryHistory.length > 1 ||
      node.podHistory.length > 1,
  )
    ? "24h"
    : "Live";
}

export function K3sClusterCard({ cluster }: K3sClusterCardProps) {
  const hasCompleteCpu =
    cluster.nodes.length > 0 &&
    cluster.nodes.every((node) => node.cpuUsedCores !== null);
  const hasCompleteMemory =
    cluster.nodes.length > 0 &&
    cluster.nodes.every((node) => node.memoryUsedBytes !== null);
  const cpuUsedCores = hasCompleteCpu
    ? cluster.nodes.reduce((total, node) => total + (node.cpuUsedCores ?? 0), 0)
    : null;
  const cpuAllocatableCores = cluster.nodes.reduce(
    (total, node) => total + node.cpuAllocatableCores,
    0,
  );
  const memoryUsedBytes = hasCompleteMemory
    ? cluster.nodes.reduce(
        (total, node) => total + (node.memoryUsedBytes ?? 0),
        0,
      )
    : null;
  const memoryAllocatableBytes = cluster.nodes.reduce(
    (total, node) => total + node.memoryAllocatableBytes,
    0,
  );
  const cpuPercent =
    cpuUsedCores !== null && cpuAllocatableCores > 0
      ? (cpuUsedCores / cpuAllocatableCores) * 100
      : null;
  const memoryPercent =
    memoryUsedBytes !== null && memoryAllocatableBytes > 0
      ? (memoryUsedBytes / memoryAllocatableBytes) * 100
      : null;
  const assignedPods = cluster.nodes.reduce(
    (total, node) => total + node.podCount,
    0,
  );
  const statusVariant = cluster.status === "down" ? "error" : "neutral";
  const rangeLabel = historyLabel(cluster.nodes);

  return (
    <LayerCard className="network-system-card k3s-system-card system-k3s">
      <LayerCard.Secondary className="system-header">
        <div className="system-identity">
          <div className="system-glyph" aria-hidden="true">
            <SystemLogo id="k3s" />
          </div>
          <div className="system-copy">
            <div className="system-title-row">
              <Text as="h3" variant="heading">
                {cluster.name}
              </Text>
              {cluster.status !== "up" && (
                <Badge
                  className="system-status-badge"
                  variant={statusVariant}
                  appearance="dot"
                >
                  {cluster.status}
                </Badge>
              )}
              <div className="system-subline">
                <Text as="span" variant="mono-secondary">
                  {cluster.address}
                </Text>
                <span>/</span>
                <Text as="span" variant="mono-secondary">
                  {cluster.version}
                </Text>
                <span>/</span>
                <Text as="span" variant="mono-secondary">
                  {cluster.podsTotal} pods
                </Text>
              </div>
            </div>
          </div>
        </div>
        <div className="system-uptime">
          <span className="micro-label">Nodes</span>
          <Text as="span" variant="mono">
            {cluster.nodesReady} / {cluster.nodesTotal} ready
          </Text>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="system-metrics">
        <MetricChart
          label="CPU load"
          value={cpuPercent === null ? "—" : cpuPercent.toFixed(1)}
          unit={cpuPercent === null ? "" : "%"}
          detail={
            cpuUsedCores === null ? (
              "—"
            ) : (
              <>
                {cpuUsedCores.toFixed(2)} cores
                <br />
                {cpuAllocatableCores.toFixed(0)} allocatable
              </>
            )
          }
          series={cluster.nodes.map((node, index) => ({
            name: node.name,
            color: NODE_COLORS[index % NODE_COLORS.length],
            data: node.cpuHistory,
          }))}
          footer={
            <>
              <NodeLegend
                nodes={cluster.nodes}
                value={(node) => node.cpuPercent}
                suffix="%"
              />
              <span>{rangeLabel}</span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(1)}%`}
        />

        <MetricChart
          label="Memory"
          value={memoryPercent === null ? "—" : memoryPercent.toFixed(1)}
          unit={memoryPercent === null ? "" : "%"}
          detail={
            memoryUsedBytes === null ? (
              "—"
            ) : (
              <>
                {formatBytes(memoryUsedBytes)}
                <br />
                {formatBytes(memoryAllocatableBytes)} allocatable
              </>
            )
          }
          series={cluster.nodes.map((node, index) => ({
            name: node.name,
            color: NODE_COLORS[index % NODE_COLORS.length],
            data: node.memoryHistory,
          }))}
          footer={
            <>
              <NodeLegend
                nodes={cluster.nodes}
                value={(node) => node.memoryPercent}
                suffix="%"
              />
              <span>{rangeLabel}</span>
            </>
          }
          tooltipValueFormat={(value) => `${value.toFixed(1)}%`}
        />

        <MetricChart
          label="Pods"
          value={cluster.status === "down" ? "—" : String(assignedPods)}
          unit={cluster.status === "down" ? "" : "pods"}
          detail={
            cluster.nodes.length === 0 ? (
              "—"
            ) : (
              <>
                {cluster.nodes.length} nodes
                <br />
                {cluster.podsTotal} cluster total
              </>
            )
          }
          series={cluster.nodes.map((node, index) => ({
            name: node.name,
            color: NODE_COLORS[index % NODE_COLORS.length],
            data: node.podHistory,
          }))}
          footer={
            <>
              <NodeLegend
                nodes={cluster.nodes}
                value={(node) => node.podCount}
                fractionDigits={0}
              />
              <span>{rangeLabel}</span>
            </>
          }
          tooltipValueFormat={(value) => `${Math.round(value)} pods`}
        />
      </LayerCard.Primary>
    </LayerCard>
  );
}
