import "server-only";

import { execFile } from "node:child_process";

interface PingOptions {
  timeout: number;
  windowsHide: boolean;
}

type PingExecutor = (
  file: string,
  args: string[],
  options: PingOptions,
  callback: (error: Error | null) => void,
) => void;

const executePing: PingExecutor = (file, args, options, callback) => {
  execFile(file, args, options, (error) => callback(error));
};

function pingArguments(host: string, timeoutMs: number): string[] {
  if (process.platform === "win32") {
    return ["-n", "1", "-w", String(timeoutMs), host];
  }

  if (process.platform === "darwin") {
    return ["-n", "-c", "1", "-W", String(timeoutMs), host];
  }

  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1_000));
  return ["-n", "-c", "1", "-W", String(timeoutSeconds), host];
}

export function requestIcmpReachability(
  host: string,
  timeoutMs: number,
  executor: PingExecutor = executePing,
): Promise<boolean> {
  return new Promise((resolve) => {
    executor(
      "ping",
      pingArguments(host, timeoutMs),
      { timeout: timeoutMs + 250, windowsHide: true },
      (error) => resolve(error === null),
    );
  });
}
