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
