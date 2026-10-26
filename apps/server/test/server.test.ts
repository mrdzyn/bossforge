import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createBossForgeApp, type BossForgeApp } from "../src/app.js";

describe("BossForge server", () => {
  let server: BossForgeApp;

  beforeEach(async () => {
    server = await createBossForgeApp({ now: () => new Date("2026-10-26T12:00:00.000Z") });
  });

  afterEach(async () => {
    await server.close();
  });

  it("returns a structured health response", async () => {
    const response = await server.app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "bossforge-server",
      version: "0.1.0",
      timestamp: "2026-10-26T12:00:00.000Z",
      connections: { websocketClients: 0, mockAdapter: "connected" },
    });
  });

  it("returns a not-found failure for unsupported health methods", async () => {
    const response = await server.app.inject({ method: "POST", url: "/health" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not found" });
  });

  it("reports live websocket connection state", async () => {
    const before = await server.app.inject({ method: "GET", url: "/health" });
    expect(before.json().connections.websocketClients).toBe(0);

    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(address.replace("http", "ws") + "/events");
    await once(client, "open");
    const during = await server.app.inject({ method: "GET", url: "/health" });
    expect(during.json().connections.websocketClients).toBe(1);
    client.close();
    await once(client, "close");
  });

  it("delivers validated mock events to a browser websocket client", async () => {
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(address.replace("http", "ws") + "/events");
    const connectionMessagePromise = once(client, "message");
    await once(client, "open");
    const connectionMessage = await connectionMessagePromise;
    expect(JSON.parse(connectionMessage[0].toString())).toMatchObject({
      type: "connection.status",
      schemaVersion: 1,
      payload: { kind: "connection.status", status: "connected" },
    });

    const eventPromise = once(client, "message");
    const response = await server.app.inject({ method: "POST", url: "/dev/simulation/next" });
    expect(response.statusCode).toBe(202);
    const [message] = await eventPromise;
    expect(JSON.parse(message.toString())).toMatchObject({
      type: "chat.event",
      schemaVersion: 1,
      payload: { kind: "viewer.connected", provider: "mock" },
    });
    client.close();
    await once(client, "close");
  });

  it("rejects invalid simulation events", async () => {
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: { kind: "chat.message", provider: "twitch", message: { text: "bad" } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid simulation event" });
  });

  it("rejects oversized request payloads", async () => {
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: { text: "x".repeat(10_000) },
    });
    expect(response.statusCode).toBe(413);
  });

  it("rate limits local simulation requests", async () => {
    for (let index = 0; index < 20; index += 1) {
      const response = await server.app.inject({ method: "POST", url: "/dev/simulation/next" });
      expect(response.statusCode).toBeLessThan(400);
    }
    const limited = await server.app.inject({ method: "POST", url: "/dev/simulation/next" });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBe("60");
  });

  it("does not expose simulation routes when production mode is selected", async () => {
    const production = await createBossForgeApp({ simulationEnabled: false });
    const response = await production.app.inject({ method: "POST", url: "/dev/simulation/next" });
    expect(response.statusCode).toBe(404);
    await production.close();
  });
});
