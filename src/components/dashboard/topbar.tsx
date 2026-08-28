"use client";

import { Badge, Text } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

import type { DashboardSnapshot } from "@/features/dashboard/types";
import { formatClock } from "@/lib/format";

interface TopbarProps {
  snapshot: DashboardSnapshot;
  refreshFailed: boolean;
}

export function Topbar({ snapshot, refreshFailed }: TopbarProps) {
  const [clock, setClock] = useState(() => formatClock(snapshot.generatedAt));
  const degraded =
    refreshFailed ||
    snapshot.issues.length > 0 ||
    snapshot.unifi.status !== "up" ||
    snapshot.systems.some((system) => system.status !== "up") ||
    snapshot.devices.some((device) => device.status !== "up");

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    updateClock();
    const interval = window.setInterval(updateClock, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand" aria-label="Homelab Index">
          <span className="brand-mark" aria-hidden="true" />
          <Text as="span" variant="body" bold>
            HOMELAB / INDEX
          </Text>
        </div>
        <div className="status-cluster" aria-live="polite">
          <Badge variant={degraded ? "warning" : "success"} appearance="dot">
            {degraded ? "Sources degraded" : "All systems online"}
          </Badge>
          <Text as="time" variant="mono-secondary">
            {clock} EEST
          </Text>
        </div>
      </div>
    </header>
  );
}
