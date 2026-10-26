import { isIP } from "node:net";

const defaultHost = "127.0.0.1";

function isLoopbackViteHost(host: unknown): host is string {
  if (typeof host !== "string") return false;
  if (host === "localhost" || host === "::1") return true;
  return isIP(host) === 4 && host.startsWith("127.");
}

export function assertLoopbackViteHost(host: unknown): asserts host is string {
  if (!isLoopbackViteHost(host)) {
    throw new Error(
      `Vite dev server host must be a loopback address (localhost, 127.0.0.1/8, or ::1); received ${JSON.stringify(host)}`,
    );
  }
}

export function getLoopbackViteHost(host = process.env.VITE_HOST): string {
  const candidate = host ?? defaultHost;
  assertLoopbackViteHost(candidate);
  return candidate;
}
