import type {
  DashboardSnapshot,
  TimeSeriesPoint,
} from "@/features/dashboard/types";

const CLIENT_HISTORY_LIMIT = 2_880;

function mergeSeries(
  previousSeries: TimeSeriesPoint[],
  incomingSeries: TimeSeriesPoint[],
): TimeSeriesPoint[] {
  if (incomingSeries.length > 1 || previousSeries.length === 0) {
    return incomingSeries;
  }

  const nextSeries = [...previousSeries];

  for (const point of incomingSeries) {
    const previousPoint = nextSeries.at(-1);

    if (previousPoint?.[0] === point[0]) {
      previousPoint[1] = point[1];
    } else {
      nextSeries.push(point);
    }
  }

  return nextSeries.slice(-CLIENT_HISTORY_LIMIT);
}

export function mergeDashboardSnapshots(
  previous: DashboardSnapshot,
  incoming: DashboardSnapshot,
): DashboardSnapshot {
  return {
    ...incoming,
    unifi: {
      ...incoming.unifi,
      traffic: {
        ...incoming.unifi.traffic,
        rxHistory: mergeSeries(
          previous.unifi.traffic.rxHistory,
          incoming.unifi.traffic.rxHistory,
        ),
        txHistory: mergeSeries(
          previous.unifi.traffic.txHistory,
          incoming.unifi.traffic.txHistory,
        ),
      },
      internet: {
        ...incoming.unifi.internet,
        latencyHistory: mergeSeries(
          previous.unifi.internet.latencyHistory,
          incoming.unifi.internet.latencyHistory,
        ),
        maximumLatencyHistory: mergeSeries(
          previous.unifi.internet.maximumLatencyHistory,
          incoming.unifi.internet.maximumLatencyHistory,
        ),
        packetLossHistory: mergeSeries(
          previous.unifi.internet.packetLossHistory,
          incoming.unifi.internet.packetLossHistory,
        ),
      },
      clients: {
        ...incoming.unifi.clients,
        history: mergeSeries(
          previous.unifi.clients.history,
          incoming.unifi.clients.history,
        ),
      },
    },
    systems: incoming.systems.map((system) => {
      const previousSystem = previous.systems.find(
        (candidate) => candidate.id === system.id,
      );

      if (!previousSystem) {
        return system;
      }

      return {
        ...system,
        cpu: {
          ...system.cpu,
          history: mergeSeries(previousSystem.cpu.history, system.cpu.history),
        },
        memory: {
          ...system.memory,
          history: mergeSeries(
            previousSystem.memory.history,
            system.memory.history,
          ),
        },
        network: {
          ...system.network,
          rxHistory: mergeSeries(
            previousSystem.network.rxHistory,
            system.network.rxHistory,
          ),
          txHistory: mergeSeries(
            previousSystem.network.txHistory,
            system.network.txHistory,
          ),
        },
      };
    }),
  };
}
