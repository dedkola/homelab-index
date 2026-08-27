import type { TimeSeriesPoint } from "@/features/dashboard/types";

const MAX_POINTS = 2_880;
const seriesStore = new Map<string, TimeSeriesPoint[]>();

export function recordHistoryPoint(
  key: string,
  timestamp: number,
  value: number,
): TimeSeriesPoint[] {
  const currentSeries = seriesStore.get(key) ?? [];
  const lastPoint = currentSeries.at(-1);

  if (lastPoint?.[0] === timestamp) {
    lastPoint[1] = value;
  } else {
    currentSeries.push([timestamp, value]);
  }

  if (currentSeries.length > MAX_POINTS) {
    currentSeries.splice(0, currentSeries.length - MAX_POINTS);
  }

  seriesStore.set(key, currentSeries);
  return currentSeries.map(([time, pointValue]) => [time, pointValue]);
}

export function resetHistoryForTests(): void {
  seriesStore.clear();
}
