"use client";

import { Text, TooltipProvider } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";

import { CoreSystemCard } from "@/components/dashboard/core-system-card";
import { LanDeviceCard } from "@/components/dashboard/lan-device-card";
import { QuickLinkCard } from "@/components/dashboard/quick-link-card";
import { Topbar } from "@/components/dashboard/topbar";
import { UniFiNetworkCard } from "@/components/dashboard/unifi-network-card";
import { mergeDashboardSnapshots } from "@/features/dashboard/merge-snapshots";
import type { DashboardSnapshot } from "@/features/dashboard/types";
import { formatClock } from "@/lib/format";

interface DashboardShellProps {
  initialSnapshot: DashboardSnapshot;
}

export function DashboardShell({ initialSnapshot }: DashboardShellProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `Dashboard refresh failed with HTTP ${response.status}`,
        );
      }

      const incomingSnapshot = (await response.json()) as DashboardSnapshot;
      setSnapshot((currentSnapshot) =>
        mergeDashboardSnapshots(currentSnapshot, incomingSnapshot),
      );
      setRefreshFailed(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRefreshFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void refresh(controller.signal);
    }, snapshot.pollIntervalMs);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh, snapshot.pollIntervalMs]);

  return (
    <TooltipProvider>
      <div className="app-shell">
        <Topbar snapshot={snapshot} refreshFailed={refreshFailed} />

        <main className="dashboard-main">
          <section
            className="dashboard-section"
            aria-labelledby="network-title"
          >
            <h2 id="network-title" className="visually-hidden">
              Network
            </h2>
            <UniFiNetworkCard network={snapshot.unifi} />
          </section>

          <section
            className="dashboard-section"
            aria-labelledby="core-systems-title"
          >
            <h2 id="core-systems-title" className="visually-hidden">
              Core systems
            </h2>
            <div className="core-grid">
              {snapshot.systems.map((system) => (
                <CoreSystemCard key={system.id} system={system} />
              ))}
            </div>
          </section>

          <section
            className="dashboard-section"
            aria-labelledby="lan-workloads-title"
          >
            <h2 id="lan-workloads-title" className="visually-hidden">
              LAN workloads
            </h2>
            <div className="devices-grid">
              {snapshot.devices.map((device) => (
                <LanDeviceCard key={device.id} device={device} />
              ))}
            </div>
          </section>

          <section
            className="dashboard-section"
            aria-labelledby="quick-links-title"
          >
            <h2 id="quick-links-title" className="visually-hidden">
              Quick links
            </h2>
            <div className="links-grid">
              {snapshot.links.map((link) => (
                <QuickLinkCard key={link.id} link={link} />
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-inner">
            <Text as="span" variant="mono-secondary">
              Homelab index
            </Text>
            <Text as="span" variant="mono-secondary">
              Last poll {formatClock(snapshot.generatedAt)}
            </Text>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
