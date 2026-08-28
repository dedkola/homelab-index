const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1000)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1000 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : fractionDigits)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatBytesPerSecond(bytesPerSecond: number): {
  value: string;
  unit: string;
} {
  const bitsPerSecond = Math.max(0, bytesPerSecond) * 8;

  if (bitsPerSecond >= 1_000_000_000) {
    return { value: (bitsPerSecond / 1_000_000_000).toFixed(2), unit: "Gb/s" };
  }

  if (bitsPerSecond >= 1_000_000) {
    return { value: (bitsPerSecond / 1_000_000).toFixed(0), unit: "Mb/s" };
  }

  if (bitsPerSecond >= 1_000) {
    return { value: (bitsPerSecond / 1_000).toFixed(0), unit: "Kb/s" };
  }

  return { value: bitsPerSecond.toFixed(0), unit: "b/s" };
}

export function formatMegabitsPerSecond(bytesPerSecond: number): string {
  const megabitsPerSecond = (Math.max(0, bytesPerSecond) * 8) / 1_000_000;

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(megabitsPerSecond)} Mb/s`;
}

export function formatDuration(totalSeconds: number | null): string {
  if (
    totalSeconds === null ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return "—";
  }

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days.toString().padStart(2, "0")}d ${hours.toString().padStart(2, "0")}h`;
  }

  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatClock(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Kyiv",
  }).format(typeof value === "string" ? new Date(value) : value);
}
