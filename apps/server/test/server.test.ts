import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createBossForgeApp, type BossForgeApp } from "../src/app.js";
import { getAllowedViteOrigins } from "../src/security/local-access.js";

describe("BossForge server", () => {
  let server: BossForgeApp;

  beforeEach(async () => {
    server = await createBossForgeApp({
      mode: "development",
      now: () => new Date("2026-10-26T12:00:00.000Z"),
    });
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
    const allowedOrigin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    expect(getAllowedViteOrigins().has(allowedOrigin)).toBe(true);
    const client = new WebSocket(address.replace("http", "ws") + "/events", {
      headers: { origin: allowedOrigin },
    });
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

  it("rejects websocket subscriptions from foreign browser origins", async () => {
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const client = new WebSocket(address.replace("http", "ws") + "/events", {
      headers: { origin: "https://foreign.example" },
    });
    const statusCode = await new Promise<number>((resolve, reject) => {
      client.once("unexpected-response", (_request, response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      client.once("open", () => {
        client.close();
        reject(new Error("Foreign origin unexpectedly opened a websocket"));
      });
      client.once("error", reject);
    });
    expect(statusCode).toBe(403);
    const health = await server.app.inject({ method: "GET", url: "/health" });
    expect(health.json().connections.websocketClients).toBe(0);
  });

  it("rejects invalid simulation events", async () => {
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        kind: "viewer.connected",
        provider: "twitch",
        viewer: { id: "twitch-viewer", displayName: "TwitchViewer" },
        occurredAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid mock simulation event" });
  });

  it("accepts valid loopback mock events in development", async () => {
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        kind: "viewer.connected",
        provider: "mock",
        viewer: { id: "mock-viewer", displayName: "MockViewer" },
        occurredAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true, kind: "viewer.connected" });
  });

  it("accepts a same-origin dashboard simulation request", async () => {
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: {
        origin: `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`,
        "sec-fetch-site": "same-origin",
      },
      remoteAddress: "127.0.0.1",
    });
    expect(response.statusCode).toBe(202);
  });

  it("rejects foreign-origin and cross-site simulation requests", async () => {
    const foreignOrigin = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: { origin: "https://foreign.example", "sec-fetch-site": "cross-site" },
      remoteAddress: "127.0.0.1",
    });
    const crossSite = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: {
        origin: `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`,
        "sec-fetch-site": "cross-site",
      },
      remoteAddress: "127.0.0.1",
    });
    expect(foreignOrigin.statusCode).toBe(403);
    expect(crossSite.statusCode).toBe(403);
  });

  it("accepts origin-less local CLI simulation and ignores spoofed forwarded IPs", async () => {
    const localCli = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      remoteAddress: "127.0.0.1",
    });
    const remoteWithSpoofedForwardedIp = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: { "x-forwarded-for": "127.0.0.1" },
      remoteAddress: "203.0.113.20",
    });
    expect(localCli.statusCode).toBe(202);
    expect(remoteWithSpoofedForwardedIp.statusCode).toBe(403);
  });

  it("rejects simulation requests from non-loopback clients", async () => {
    const next = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: { "x-forwarded-for": "127.0.0.1" },
      remoteAddress: "203.0.113.20",
    });
    const custom = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      remoteAddress: "203.0.113.20",
      payload: {
        kind: "viewer.connected",
        provider: "mock",
        viewer: { id: "mock-viewer", displayName: "MockViewer" },
        occurredAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(next.statusCode).toBe(403);
    expect(custom.statusCode).toBe(403);
  });

  it("rejects websocket subscriptions outside development mode", async () => {
    const production = await createBossForgeApp({ mode: "production" });
    const response = await production.app.inject({
      method: "GET",
      url: "/events",
      headers: { origin: "http://127.0.0.1:5173" },
    });
    expect(response.statusCode).toBe(403);
    await production.close();
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
    const production = await createBossForgeApp({ mode: "production", simulationEnabled: true });
    const response = await production.app.inject({ method: "POST", url: "/dev/simulation/next" });
    expect(response.statusCode).toBe(404);
    await production.close();
  });
});
