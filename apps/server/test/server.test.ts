import { once } from "node:events";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { ForgeStateReconciler } from "@bossforge/shared";
import { createBossForgeApp, type BossForgeApp } from "../src/app.js";
import { getAllowedViteOrigins } from "../src/security/local-access.js";
import { TwitchOAuth } from "../src/twitch/oauth.js";

class FakeTwitchSocket extends EventEmitter {
  sendFrame(value: unknown): void {
    this.emit("message", Buffer.from(JSON.stringify(value)));
  }
}

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

  it("returns an idle revision-zero snapshot after a backend process restart", async () => {
    let scheduled: (() => void) | undefined;
    const oldProcess = await createBossForgeApp({
      mode: "development",
      serverInstanceId: "old-process",
      serverStartedAt: "2026-10-26T12:00:00.000Z",
      now: () => new Date("2026-10-26T12:00:00.000Z"),
      forgeScheduler: {
        schedule(callback) {
          scheduled = callback;
          return () => undefined;
        },
      },
    });
    const started = await oldProcess.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      payload: { durationSeconds: 15 },
    });
    expect(started.statusCode).toBe(200);
    for (let category = 0; category < 4; category += 1) scheduled?.();
    const revealed = await oldProcess.app.inject({ method: "GET", url: "/forge/state" });
    expect(revealed.json()).toMatchObject({
      serverInstanceId: "old-process",
      status: "revealed",
      revision: 5,
      boss: { name: expect.any(String) },
    });
    await oldProcess.close();

    const restarted = await createBossForgeApp({
      mode: "development",
      serverInstanceId: "new-process",
      serverStartedAt: "2026-10-26T12:01:00.000Z",
    });
    const idle = await restarted.app.inject({ method: "GET", url: "/forge/state" });
    expect(idle.statusCode).toBe(200);
    expect(idle.json()).toMatchObject({
      serverInstanceId: "new-process",
      status: "idle",
      revision: 0,
      boss: null,
    });
    const freshCycle = await restarted.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      payload: { durationSeconds: 15 },
    });
    expect(freshCycle.json()).toMatchObject({
      serverInstanceId: "new-process",
      status: "voting",
      revision: 1,
      activeCategory: "body",
    });
    await restarted.close();
  });

  it("returns a not-found failure for unsupported health methods", async () => {
    const response = await server.app.inject({ method: "POST", url: "/health" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Not found" });
  });

  it("keeps Twitch authorization disabled by default and rejects a mismatched callback Host", async () => {
    const disabled = await server.app.inject({
      method: "GET",
      url: "/auth/twitch",
      headers: { host: "localhost:3001" },
      remoteAddress: "127.0.0.1",
    });
    expect(disabled.statusCode).toBe(503);
    const wrongHost = await server.app.inject({
      method: "GET",
      url: "/auth/twitch",
      headers: { host: "127.0.0.1:3001" },
      remoteAddress: "127.0.0.1",
    });
    expect(wrongHost.statusCode).toBe(403);
  });

  it("rejects OAuth callback denial and duplicate authorization parameters without contacting Twitch", async () => {
    const denied = await server.app.inject({
      method: "GET",
      url: "/auth/twitch/callback?error=access_denied&state=bad-state",
      headers: { host: "localhost:3001" },
      remoteAddress: "127.0.0.1",
    });
    expect(denied.statusCode).toBe(400);
    const duplicate = await server.app.inject({
      method: "GET",
      url: "/auth/twitch/callback?state=one&state=two&code=code",
      headers: { host: "localhost:3001" },
      remoteAddress: "127.0.0.1",
    });
    expect(duplicate.statusCode).toBe(400);
  });

  it("requires OAuth owner controls and keeps live Twitch ballots separate from mock simulation", async () => {
    const sockets: FakeTwitchSocket[] = [];
    const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/token"))
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          }),
        );
      if (url.endsWith("/validate"))
        return new Response(
          JSON.stringify({
            client_id: "client-id",
            user_id: "12345",
            login: "owner",
            user_name: "Owner",
            scopes: ["user:read:chat"],
          }),
        );
      if (url.includes("/eventsub/subscriptions")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            data: [
              {
                type: "channel.chat.message",
                version: "1",
                status: "enabled",
                condition: { broadcaster_user_id: "12345", user_id: "12345" },
                transport: { session_id: "live-session" },
              },
            ],
          }),
          { status: 202 },
        );
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const oauth = new TwitchOAuth({
      clientId: "client-id",
      clientSecret: "test-only-secret",
      redirectUri: "http://localhost:3001/auth/twitch/callback",
      enabled: true,
      fetch: mockFetch,
    });
    const live = await createBossForgeApp({
      mode: "development",
      twitchOAuth: oauth,
      twitchFetch: mockFetch,
      twitchCreateSocket: () => {
        const socket = new FakeTwitchSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const origin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    const start = await live.app.inject({
      method: "GET",
      url: "/auth/twitch",
      headers: { host: "localhost:3001" },
      remoteAddress: "127.0.0.1",
    });
    expect(start.statusCode).toBe(302);
    expect(String(start.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(start.headers["set-cookie"])).toContain("SameSite=Lax");
    const authLocation = new URL(start.headers.location!);
    const state = authLocation.searchParams.get("state")!;
    const stateCookieHeader = start.headers["set-cookie"];
    const stateCookie = (
      Array.isArray(stateCookieHeader) ? stateCookieHeader[0] : stateCookieHeader
    )!.split(";")[0]!;
    const callback = await live.app.inject({
      method: "GET",
      url: `/auth/twitch/callback?state=${encodeURIComponent(state)}&code=test-code`,
      headers: { host: "localhost:3001", cookie: stateCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers["cache-control"]).toBe("no-store");
    const sessionCookies = callback.headers["set-cookie"];
    const sessionCookie = (Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies])
      .find((value) => value?.startsWith("bossforge_twitch_session="))!
      .split(";")[0]!;

    const unauthenticated = await live.app.inject({
      method: "POST",
      url: "/twitch/connect",
      headers: { host: "localhost:3001", origin },
      remoteAddress: "127.0.0.1",
    });
    expect(unauthenticated.statusCode).toBe(401);
    const foreignOrigin = await live.app.inject({
      method: "POST",
      url: "/twitch/connect",
      headers: { host: "localhost:3001", origin: "https://foreign.example", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(foreignOrigin.statusCode).toBe(403);
    const reconciler = new ForgeStateReconciler();
    const generation = reconciler.beginConnection();
    const mockBefore = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(reconciler.apply(mockBefore, generation)).toBe(true);
    const connected = await live.app.inject({
      method: "POST",
      url: "/twitch/connect",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        cookie: sessionCookie,
      },
      remoteAddress: "127.0.0.1",
    });
    expect(connected.statusCode).toBe(202);
    const connectingState = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(connectingState).toMatchObject({ mode: "twitch", connectedToTwitch: false });
    expect(Date.parse(connectingState.serverStartedAt)).toBeGreaterThan(
      Date.parse(mockBefore.serverStartedAt),
    );
    expect(reconciler.apply(connectingState, generation)).toBe(true);
    expect(reconciler.apply(mockBefore, generation)).toBe(false);
    expect(sockets).toHaveLength(1);

    const noOriginControl = await live.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      headers: { host: "localhost:3001", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
      payload: { durationSeconds: 5 },
    });
    expect(noOriginControl.statusCode).toBe(403);

    sockets[0]!.sendFrame({
      metadata: {
        message_id: "welcome-id",
        message_type: "session_welcome",
        message_timestamp: new Date().toISOString(),
      },
      payload: { session: { id: "live-session", keepalive_timeout_seconds: 30 } },
    });
    await vi.waitFor(async () => {
      const status = await live.app.inject({
        method: "GET",
        url: "/twitch/status",
        remoteAddress: "127.0.0.1",
      });
      expect(status.json().connected).toBe(true);
    });
    const twitchConnectedState = (
      await live.app.inject({
        method: "GET",
        url: "/forge/state",
      })
    ).json();
    expect(twitchConnectedState).toMatchObject({ mode: "twitch", connectedToTwitch: true });
    expect(reconciler.apply(twitchConnectedState, generation)).toBe(true);
    expect(reconciler.apply(connectingState, generation)).toBe(false);
    const started = await live.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        cookie: sessionCookie,
      },
      remoteAddress: "127.0.0.1",
      payload: { durationSeconds: 5 },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({
      mode: "twitch",
      simulated: false,
      connectedToTwitch: true,
    });
    const twitchVotingState = (
      await live.app.inject({
        method: "GET",
        url: "/forge/state",
      })
    ).json();
    expect(twitchVotingState).toMatchObject({ mode: "twitch", status: "voting" });
    expect(reconciler.apply(twitchVotingState, generation)).toBe(true);
    const mockInjection = await live.app.inject({
      method: "POST",
      url: "/dev/simulation/next",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        cookie: sessionCookie,
      },
      remoteAddress: "127.0.0.1",
    });
    expect(mockInjection.statusCode).toBe(403);
    const reset = await live.app.inject({
      method: "POST",
      url: "/dev/forge/reset",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        cookie: sessionCookie,
      },
      remoteAddress: "127.0.0.1",
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toMatchObject({ mode: "twitch", status: "idle", connectedToTwitch: true });
    const twitchState = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(reconciler.apply(twitchState, generation)).toBe(true);
    const logout = await live.app.inject({
      method: "POST",
      url: "/twitch/disconnect",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        cookie: sessionCookie,
      },
      remoteAddress: "127.0.0.1",
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toMatchObject({ disconnected: true, mode: "mock" });
    expect(String(logout.headers["set-cookie"])).toContain("Max-Age=0");
    const mockAfterLogout = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(mockAfterLogout).toMatchObject({ mode: "mock", simulated: true, status: "idle" });
    expect(Date.parse(mockAfterLogout.serverStartedAt)).toBeGreaterThan(
      Date.parse(twitchState.serverStartedAt),
    );
    expect(reconciler.apply(mockAfterLogout, generation)).toBe(true);
    expect(reconciler.apply(twitchState, generation)).toBe(false);
    const simulateAfterLogout = await live.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
      },
      remoteAddress: "127.0.0.1",
      payload: { durationSeconds: 5 },
    });
    expect(simulateAfterLogout.statusCode).toBe(200);
    expect(simulateAfterLogout.json()).toMatchObject({ mode: "mock", simulated: true });
    await live.close();
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

  it("runs a server-authoritative forge cycle and broadcasts versioned state to connected clients", async () => {
    const snapshot = await server.app.inject({ method: "GET", url: "/forge/state" });
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json()).toMatchObject({
      status: "idle",
      simulated: true,
      connectedToTwitch: false,
    });
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const origin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    const clients = [0, 1].map(
      () => new WebSocket(address.replace("http", "ws") + "/events", { headers: { origin } }),
    );
    await Promise.all(clients.map((client) => once(client, "open")));
    const waitForForge = (client: WebSocket) =>
      new Promise<unknown>((resolve) => {
        const handler = (data: WebSocket.RawData) => {
          const envelope = JSON.parse(data.toString()) as { type?: string };
          if (envelope.type === "forge.state") {
            client.off("message", handler);
            resolve(envelope);
          }
        };
        client.on("message", handler);
      });
    const updates = clients.map(waitForForge);
    const started = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      payload: { durationSeconds: 5 },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ status: "voting", activeCategory: "body" });
    expect(await Promise.all(updates)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "forge.state" }),
        expect.objectContaining({ type: "forge.state" }),
      ]),
    );
    const invalid = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        kind: "chat.message",
        provider: "twitch",
        message: {
          id: "x",
          viewer: { id: "viewer", displayName: "Viewer" },
          text: "!vote body drake",
          occurredAt: "2026-10-26T12:00:00.000Z",
        },
      },
    });
    expect(invalid.statusCode).toBe(400);
    const voteUpdate = clients.map(waitForForge);
    const vote = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        kind: "chat.message",
        provider: "mock",
        message: {
          id: "phase1-vote-1",
          viewer: { id: "viewer", displayName: "Viewer" },
          text: "!vote body drake",
          occurredAt: "2026-10-26T12:00:00.000Z",
        },
      },
    });
    expect(vote.statusCode).toBe(202);
    expect(await Promise.all(voteUpdate)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "forge.state" }),
        expect.objectContaining({ type: "forge.state" }),
      ]),
    );
    const state = await server.app.inject({ method: "GET", url: "/forge/state" });
    expect(state.json().categories[0]).toMatchObject({
      totalVotes: 1,
      options: expect.arrayContaining([expect.objectContaining({ choice: "drake", count: 1 })]),
    });
    for (const client of clients) {
      client.close();
      await once(client, "close");
    }
    const reconnected = new WebSocket(address.replace("http", "ws") + "/events", {
      headers: { origin },
    });
    await once(reconnected, "open");
    const reconnectSnapshot = await server.app.inject({ method: "GET", url: "/forge/state" });
    expect(reconnectSnapshot.json()).toMatchObject({
      status: "voting",
      revision: expect.any(Number),
    });
    expect(reconnectSnapshot.json().categories[0]).toMatchObject({ totalVotes: 1 });
    reconnected.close();
    await once(reconnected, "close");
  });

  it("protects forge mutations from remote and foreign-origin callers", async () => {
    const remote = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      remoteAddress: "203.0.113.9",
      payload: {},
    });
    const foreign = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      remoteAddress: "127.0.0.1",
      headers: { origin: "https://foreign.example", "sec-fetch-site": "cross-site" },
      payload: {},
    });
    const local = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      remoteAddress: "127.0.0.1",
      headers: {
        origin: `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`,
        "sec-fetch-site": "same-origin",
      },
      payload: { durationSeconds: 5 },
    });
    expect(remote.statusCode).toBe(403);
    expect(foreign.statusCode).toBe(403);
    expect(local.statusCode).toBe(200);
    const duplicateStart = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      remoteAddress: "127.0.0.1",
      payload: { durationSeconds: 5 },
    });
    const reset = await server.app.inject({
      method: "POST",
      url: "/dev/forge/reset",
      remoteAddress: "127.0.0.1",
    });
    const repeatedReset = await server.app.inject({
      method: "POST",
      url: "/dev/forge/reset",
      remoteAddress: "127.0.0.1",
    });
    const invalidDuration = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      remoteAddress: "127.0.0.1",
      payload: { durationSeconds: 4 },
    });
    expect(duplicateStart.statusCode).toBe(409);
    expect(reset.statusCode).toBe(200);
    expect(repeatedReset.statusCode).toBe(409);
    expect(invalidDuration.statusCode).toBe(400);
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
    const startForge = await production.app.inject({ method: "POST", url: "/dev/forge/start" });
    const forgeSnapshot = await production.app.inject({ method: "GET", url: "/forge/state" });
    const oauthStart = await production.app.inject({ method: "GET", url: "/auth/twitch" });
    const twitchStatus = await production.app.inject({ method: "GET", url: "/twitch/status" });
    expect(startForge.statusCode).toBe(404);
    expect(forgeSnapshot.statusCode).toBe(404);
    expect(oauthStart.statusCode).toBe(404);
    expect(twitchStatus.statusCode).toBe(404);
    await production.close();
  });
});
