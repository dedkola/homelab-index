"use client";

import { useEffect, useRef, useState } from "react";

import { Button, LayerCard, LinkButton, Text, Tooltip } from "@cloudflare/kumo";
import { ArrowSquareOutIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";

import {
  hasServiceLogo,
  ServiceLogo,
} from "@/components/dashboard/service-logo";
import type { LanDevice } from "@/features/dashboard/types";

interface LanDeviceCardProps {
  device: LanDevice;
}

const KIND_GLYPHS = {
  vm: "VM",
  container: "CT",
  host: "HS",
  device: "DV",
} as const;

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for LAN dashboards without clipboard permission.
    }
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();

  const copied = document.execCommand("copy");
  input.remove();

  if (!copied) {
    throw new Error("Unable to copy IP address");
  }
}

export function LanDeviceCard({ device }: LanDeviceCardProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const host =
    device.provider.type === "proxmox" ? device.address : device.provider.host;
  const serviceLogoId = hasServiceLogo(device.id) ? device.id : null;

  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  async function handleCopyIp(): Promise<void> {
    try {
      await copyText(host);
      setCopied(true);

      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }

      resetTimer.current = setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <LayerCard className="device-card">
      <div className="device-topline">
        <div className="device-identity">
          <div className="device-glyph" aria-hidden="true">
            {serviceLogoId ? (
              <ServiceLogo id={serviceLogoId} />
            ) : (
              KIND_GLYPHS[device.kind]
            )}
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

        <div className="device-side">
          <div className="device-status" data-status={device.status}>
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
          </div>

          <div className="device-actions">
            {device.url ? (
              <Tooltip
                content={`Open ${device.name}`}
                render={
                  <LinkButton
                    href={device.url}
                    external
                    variant="ghost"
                    size="xs"
                    shape="square"
                    icon={ArrowSquareOutIcon}
                    aria-label={`Open ${device.name} in a new window`}
                  />
                }
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              shape="square"
              icon={copied ? CheckIcon : CopyIcon}
              title={copied ? "IP copied" : "Copy IP"}
              aria-label={
                copied
                  ? `${device.name} IP copied`
                  : `Copy ${device.name} IP address`
              }
              onClick={() => void handleCopyIp()}
            />
          </div>
        </div>
      </div>
    </LayerCard>
  );
}
