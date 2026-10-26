import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertLoopbackViteHost, getLoopbackViteHost } from "../../web/src/dev-server-host.js";

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

  it("rejects boolean host values that Vite treats as all interfaces", () => {
    expect(() => assertLoopbackViteHost(true)).toThrow(/must be a loopback address/);
  });

  it("rejects the CLI host override before a listener is established", async () => {
    const webDirectory = fileURLToPath(new URL("../../web/", import.meta.url));
    const viteCli = fileURLToPath(
      new URL("../../web/node_modules/vite/bin/vite.js", import.meta.url),
    );
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => {
      reservation.once("error", reject);
      reservation.listen(0, "0.0.0.0", resolve);
    });
    const address = reservation.address();
    if (!address || typeof address === "string") throw new Error("Could not reserve test port");
    const port = address.port;
    await new Promise<void>((resolve, reject) => {
      reservation.close((error) => (error ? reject(error) : resolve()));
    });

    const result = spawnSync(
      process.execPath,
      [viteCli, "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
      {
        cwd: webDirectory,
        env: { ...process.env, VITE_HOST: "127.0.0.1" },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Vite dev server host must be a loopback address",
    );

    const listenerProbe = createServer();
    await new Promise<void>((resolve, reject) => {
      listenerProbe.once("error", reject);
      listenerProbe.listen(port, "0.0.0.0", resolve);
    });
    await new Promise<void>((resolve, reject) => {
      listenerProbe.close((error) => (error ? reject(error) : resolve()));
    });
  });
});
