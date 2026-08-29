import { describe, expect, it, vi } from "vitest";

import { requestIcmpReachability } from "@/lib/icmp";

describe("ICMP reachability", () => {
  it("reports a successful ping as up", async () => {
    const executor = vi.fn((_file, _args, _options, callback) =>
      callback(null),
    );

    await expect(
      requestIcmpReachability("192.168.0.159", 1_000, executor),
    ).resolves.toBe(true);
    expect(executor).toHaveBeenCalledWith(
      "ping",
      expect.arrayContaining(["192.168.0.159"]),
      expect.objectContaining({ timeout: 1_250 }),
      expect.any(Function),
    );
  });

  it("reports a failed ping as down", async () => {
    const executor = vi.fn((_file, _args, _options, callback) =>
      callback(new Error("unreachable")),
    );

    await expect(
      requestIcmpReachability("192.168.0.159", 1_000, executor),
    ).resolves.toBe(false);
  });
});
