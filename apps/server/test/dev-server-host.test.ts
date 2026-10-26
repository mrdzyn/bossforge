import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getLoopbackViteHost } from "../../web/src/dev-server-host.js";

describe("Vite development bind host", () => {
  it("defaults to loopback and accepts explicit loopback addresses", () => {
    expect(getLoopbackViteHost(undefined)).toBe("127.0.0.1");
    expect(getLoopbackViteHost("127.0.0.1")).toBe("127.0.0.1");
    expect(getLoopbackViteHost("127.10.20.30")).toBe("127.10.20.30");
    expect(getLoopbackViteHost("localhost")).toBe("localhost");
    expect(getLoopbackViteHost("::1")).toBe("::1");
  });

  it.each(["0.0.0.0", "192.0.2.10", "::", "", "[::1]"])(
    "fails closed for non-loopback or ambiguous host %j",
    (host) => {
      expect(() => getLoopbackViteHost(host)).toThrow(/must be a loopback address/);
    },
  );

  it("refuses to start Vite when the proxy would bind to an external interface", () => {
    const webDirectory = fileURLToPath(new URL("../../web/", import.meta.url));
    const viteCli = fileURLToPath(
      new URL("../../web/node_modules/vite/bin/vite.js", import.meta.url),
    );
    const result = spawnSync(process.execPath, [viteCli], {
      cwd: webDirectory,
      env: { ...process.env, VITE_HOST: "0.0.0.0" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("VITE_HOST must be a loopback address");
  });
});
