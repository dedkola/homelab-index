import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import { requestTcpReachability } from "@/lib/tcp";

describe("TCP reachability", () => {
  it("reports an accepting port as up and a closed port as down", async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe("string");

    if (!address || typeof address === "string") {
      throw new Error("Expected a TCP server address");
    }

    await expect(
      requestTcpReachability("127.0.0.1", address.port, 1_000),
    ).resolves.toBe(true);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    await expect(
      requestTcpReachability("127.0.0.1", address.port, 1_000),
    ).resolves.toBe(false);
  });
});
