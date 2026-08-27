import { describe, expect, it } from "vitest";

import {
  clampPercent,
  formatBytes,
  formatBytesPerSecond,
  formatDuration,
} from "@/lib/format";

describe("dashboard formatters", () => {
  it("clamps percentages to their display range", () => {
    expect(clampPercent(-2)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it("formats byte totals and network rates", () => {
    expect(formatBytes(53_800_000_000)).toBe("53.8 GB");
    expect(formatBytesPerSecond(125_000_000)).toEqual({
      value: "1.00",
      unit: "Gb/s",
    });
    expect(formatBytesPerSecond(8_000_000)).toEqual({
      value: "64",
      unit: "Mb/s",
    });
  });

  it("formats compact uptimes", () => {
    expect(formatDuration(14 * 86_400 + 9 * 3_600)).toBe("14d 09h");
    expect(formatDuration(3 * 3_600 + 12 * 60)).toBe("03h 12m");
    expect(formatDuration(null)).toBe("—");
  });
});
