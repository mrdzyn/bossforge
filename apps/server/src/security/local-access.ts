import { isIP } from "node:net";

const loopbackViteHosts = ["localhost", "127.0.0.1", "[::1]"];

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  const candidate = mappedIpv4 ?? address;
  if (isIP(candidate) === 4) return candidate.startsWith("127.");
  return isIP(candidate) === 6 && candidate.toLowerCase() === "::1";
}

export function getAllowedViteOrigins(portValue = process.env.VITE_PORT): ReadonlySet<string> {
  const port = Number(portValue ?? 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return new Set();

  return new Set(loopbackViteHosts.map((host) => `http://${host}:${port}`));
}

export function isAllowedViteOrigin(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (origin === undefined) return true;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && allowedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

export function isAllowedLocalMutationRequest(
  origin: string | undefined,
  fetchSite: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (fetchSite !== undefined && fetchSite !== "same-origin") return false;
  return isAllowedViteOrigin(origin, allowedOrigins);
}
