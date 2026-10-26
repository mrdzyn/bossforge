import { isIP } from "node:net";

const defaultHost = "127.0.0.1";

function isLoopbackViteHost(host: string): boolean {
  if (host === "localhost" || host === "::1") return true;
  return isIP(host) === 4 && host.startsWith("127.");
}

export function getLoopbackViteHost(host = process.env.VITE_HOST): string {
  const candidate = host ?? defaultHost;
  if (!isLoopbackViteHost(candidate)) {
    throw new Error(
      `VITE_HOST must be a loopback address (localhost, 127.0.0.1/8, or ::1); received ${JSON.stringify(candidate)}`,
    );
  }
  return candidate;
}
