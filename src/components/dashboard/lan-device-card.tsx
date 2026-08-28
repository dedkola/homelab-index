"use client";

import { LayerCard, LinkButton, Meter, Text, Tooltip } from "@cloudflare/kumo";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";

import type { LanDevice } from "@/features/dashboard/types";
import { formatDuration } from "@/lib/format";

interface LanDeviceCardProps {
  device: LanDevice;
}

const KIND_GLYPHS = {
  vm: "VM",
  container: "CT",
  host: "HS",
  device: "DV",
} as const;

function metricValue(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export function LanDeviceCard({ device }: LanDeviceCardProps) {
  return (
    <LayerCard className="device-card">
      <div className="device-topline">
        <div className="device-identity">
          <div className="device-glyph" aria-hidden="true">
            {KIND_GLYPHS[device.kind]}
          </div>
          <div className="device-copy">
            <Text as="h3" variant="heading">
              {device.name}
            </Text>
            <Text as="span" variant="mono-secondary">
              {device.address}
            </Text>
          </div>
        </div>
        {device.url ? (
          <Tooltip
            content={`Open ${device.name}`}
            render={
              <LinkButton
                href={device.url}
                external
                variant="outline"
                size="xs"
                shape="square"
                icon={ArrowSquareOutIcon}
                aria-label={`Open ${device.name} in a new window`}
              />
            }
          />
        ) : null}
      </div>

      <div className="device-meters">
        <div className="device-meter cpu-meter">
          <Meter
            label="CPU"
            value={device.cpuPercent ?? 0}
            customValue={metricValue(device.cpuPercent)}
            indicatorClassName="bg-[var(--orange)]"
          />
        </div>
        <div className="device-meter memory-meter">
          <Meter
            label="MEM"
            value={device.memoryPercent ?? 0}
            customValue={metricValue(device.memoryPercent)}
            indicatorClassName="bg-[var(--blue)]"
          />
        </div>
      </div>

      <div className="device-meta">
        <Text
          as="span"
          variant={
            device.status === "up"
              ? "success"
              : device.status === "down"
                ? "error"
                : "secondary"
          }
          size="xs"
        >
          {device.status === "up"
            ? "● Up"
            : device.status === "down"
              ? "● Down"
              : "○ Unknown"}
        </Text>
        <Text as="span" variant="mono-secondary">
          {formatDuration(device.uptimeSeconds)}
        </Text>
      </div>
    </LayerCard>
  );
}
