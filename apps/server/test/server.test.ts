import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import {
  DashboardEventEnvelopeSchema,
  ForgeStateReconciler,
  OverlayBattleStateV1Schema,
  OverlayEventEnvelopeSchema,
} from "@bossforge/shared";
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

  it("serves a strict privacy-projected overlay battle snapshot without caching", async () => {
    const response = await server.app.inject({ method: "GET", url: "/battle/overlay-state" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().status).toBe("idle");
    expect(response.json()).not.toHaveProperty("profileSnapshot");
    expect(response.json()).not.toHaveProperty("profileId");
  });

  it("publishes one ready battle after forge reveal and starts only by authenticated same-origin local action", async () => {
    let transition: (() => void) | undefined;
    const app = await createBossForgeApp({
      mode: "development",
      serverInstanceId: "battle-server",
      serverStartedAt: "2026-10-26T12:00:00.000Z",
      now: () => new Date("2026-10-26T12:00:00.000Z"),
      forgeScheduler: {
        schedule(callback) {
          transition = callback;
          return () => undefined;
        },
      },
    });
    const headers = { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" };
    const initial = await app.app.inject({ method: "GET", url: "/battle/state" });
    expect(initial.statusCode).toBe(200);
    expect(initial.headers["cache-control"]).toBe("no-store");
    expect(initial.json().status).toBe("idle");
    expect(
      (
        await app.app.inject({
          method: "POST",
          url: "/dev/battle/damage",
          headers,
          payload: { damage: 1 },
        })
      ).statusCode,
    ).toBe(404);
    await app.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      payload: { durationSeconds: 15 },
    });
    for (let i = 0; i < 4; i += 1) transition?.();
    const ready = await app.app.inject({ method: "GET", url: "/battle/state" });
    expect(ready.json()).toMatchObject({
      status: "ready",
      forgeCycleId: "forge-1",
      currentHp: null,
      durationSeconds: null,
    });
    const started = await app.app.inject({
      method: "POST",
      url: "/dev/battle/start",
      headers,
      payload: {
        requestId: "00000000-0000-4000-8000-000000000001",
        expectedRevision: ready.json().revision,
        forgeIdentity: ready.json().forgeIdentity,
        forgeCycleId: "forge-1",
        durationSeconds: 90,
        audienceBand: "medium",
      },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ status: "active", maxHp: 550, currentHp: 550 });
    const repeated = await app.app.inject({
      method: "POST",
      url: "/dev/battle/start",
      headers,
      payload: {
        requestId: "00000000-0000-4000-8000-000000000001",
        expectedRevision: ready.json().revision,
        forgeIdentity: ready.json().forgeIdentity,
        forgeCycleId: "forge-1",
        durationSeconds: 90,
        audienceBand: "medium",
      },
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().encounterId).toBe(started.json().encounterId);
    const cancelBody = {
      requestId: "00000000-0000-4000-8000-000000000003",
      expectedRevision: started.json().revision,
      encounterId: started.json().encounterId,
    };
    const cancelled = await app.app.inject({
      method: "POST",
      url: "/dev/battle/cancel",
      headers,
      payload: cancelBody,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({
      status: "cancelled",
      cancelReason: "owner_cancelled",
      currentHp: 550,
    });
    const cancelRetry = await app.app.inject({
      method: "POST",
      url: "/dev/battle/cancel",
      headers,
      payload: cancelBody,
    });
    expect(cancelRetry.statusCode).toBe(200);
    expect(cancelRetry.json().revision).toBe(cancelled.json().revision);
    expect(
      (
        await app.app.inject({
          method: "POST",
          url: "/dev/battle/cancel",
          headers: { "sec-fetch-site": "same-origin" },
          payload: cancelBody,
        })
      ).json(),
    ).toEqual({ error: "origin_rejected" });
    expect(
      (
        await app.app.inject({
          method: "POST",
          url: "/dev/battle/start",
          payload: { requestId: "00000000-0000-4000-8000-000000000002" },
        })
      ).statusCode,
    ).toBe(403);
    await app.close();
  });

  it("does not register battle mutation routes in production mode", async () => {
    const production = await createBossForgeApp({ mode: "production" });
    expect(
      (await production.app.inject({ method: "POST", url: "/dev/battle/start" })).statusCode,
    ).toBe(404);
    await production.close();
  });

  it("creates and starts a new forge-1 encounter across mock→Twitch→mock transitions", async () => {
    const forgeTimers: { callback: () => void; cancelled: boolean }[] = [];
    const sockets: FakeTwitchSocket[] = [];
    const oauth = {
      configured: true,
      identityFor: (cookie: string | undefined) =>
        cookie === "synthetic-owner-session"
          ? { id: "12345", login: "synthetic-owner", displayName: "Synthetic Owner" }
          : undefined,
      accessToken: async () => "synthetic-access-token",
      refreshAccessToken: async () => "synthetic-access-token",
      logout: async () => undefined,
      close: () => undefined,
    } as unknown as TwitchOAuth;
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/eventsub/subscriptions")) {
        const body = JSON.parse(String(init?.body)) as { transport: { session_id: string } };
        return new Response(
          JSON.stringify({
            data: [
              {
                type: "channel.chat.message",
                version: "1",
                status: "enabled",
                condition: { broadcaster_user_id: "12345", user_id: "12345" },
                transport: { session_id: body.transport.session_id },
              },
            ],
          }),
          { status: 202 },
        );
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const app = await createBossForgeApp({
      mode: "development",
      serverInstanceId: "application-epoch",
      serverStartedAt: "2026-10-29T00:00:00.000Z",
      now: () => new Date("2026-10-29T00:00:00.000Z"),
      twitchOAuth: oauth,
      twitchFetch: mockFetch,
      forgeScheduler: {
        schedule(callback) {
          const timer = { callback, cancelled: false };
          forgeTimers.push(timer);
          return () => {
            timer.cancelled = true;
          };
        },
      },
      battleScheduler: { schedule: () => () => undefined },
      twitchEventSubScheduler: { schedule: () => () => undefined },
      twitchCreateSocket: () => {
        const socket = new FakeTwitchSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const ownerHeaders = {
      origin: `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`,
      "sec-fetch-site": "same-origin",
      cookie: "bossforge_twitch_session=synthetic-owner-session",
    };
    const localHeaders = {
      origin: ownerHeaders.origin,
      "sec-fetch-site": "same-origin",
    };
    const finishForge = async (headers: typeof localHeaders = localHeaders) => {
      expect(
        (
          await app.app.inject({
            method: "POST",
            url: "/dev/forge/start",
            headers,
            payload: { durationSeconds: 5 },
          })
        ).statusCode,
      ).toBe(200);
      for (let index = 0; index < 4; index += 1) {
        const timer = forgeTimers.shift();
        expect(timer?.cancelled).toBe(false);
        timer?.callback();
      }
      return (await app.app.inject({ method: "GET", url: "/forge/state" })).json();
    };
    const startCurrentBattle = async (headers: typeof localHeaders) => {
      const current = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      return app.app.inject({
        method: "POST",
        url: "/dev/battle/start",
        headers,
        payload: {
          requestId: randomUUID(),
          expectedRevision: current.revision,
          forgeIdentity: current.forgeIdentity,
          forgeCycleId: current.forgeCycleId,
          durationSeconds: 60,
          audienceBand: "low",
        },
      });
    };

    try {
      const mockForge = await finishForge();
      expect(mockForge).toMatchObject({ mode: "mock", status: "revealed", cycleId: "forge-1" });
      const mockReady = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      const firstStart = await startCurrentBattle(localHeaders);
      expect(firstStart.statusCode).toBe(200);
      const firstEncounterId = firstStart.json().encounterId;

      expect(
        (await app.app.inject({ method: "POST", url: "/twitch/connect", headers: ownerHeaders }))
          .statusCode,
      ).toBe(202);
      expect((await app.app.inject({ method: "GET", url: "/battle/state" })).json()).toMatchObject({
        status: "cancelled",
        cancelReason: "provider_changed",
      });
      sockets[0]!.sendFrame({
        metadata: {
          message_id: "synthetic-welcome",
          message_type: "session_welcome",
          message_timestamp: "2026-10-29T00:00:00.000Z",
        },
        payload: { session: { id: "synthetic-session", keepalive_timeout_seconds: 30 } },
      });
      await vi.waitFor(async () => {
        expect(
          (await app.app.inject({ method: "GET", url: "/twitch/status" })).json().connected,
        ).toBe(true);
      });
      const twitchForge = await finishForge(ownerHeaders);
      expect(twitchForge).toMatchObject({ mode: "twitch", status: "revealed", cycleId: "forge-1" });
      const twitchReady = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      expect(twitchReady.status).toBe("ready");
      expect(twitchReady.encounterId).not.toBe(firstEncounterId);
      expect(twitchReady.forgeIdentity).toMatchObject({
        serverInstanceId: twitchForge.serverInstanceId,
        serverStartedAt: twitchForge.serverStartedAt,
        mode: "twitch",
      });
      const twitchStart = await startCurrentBattle(ownerHeaders);
      expect(twitchStart.statusCode).toBe(200);
      const twitchEncounterId = twitchStart.json().encounterId;
      sockets[0]!.sendFrame({
        metadata: {
          message_id: "synthetic-hit-frame",
          message_type: "notification",
          message_timestamp: new Date().toISOString(),
          subscription_type: "channel.chat.message",
          subscription_version: "1",
        },
        payload: {
          subscription: {
            type: "channel.chat.message",
            version: "1",
            condition: { broadcaster_user_id: "12345", user_id: "12345" },
          },
          event: {
            broadcaster_user_id: "12345",
            chatter_user_id: "777",
            chatter_user_login: "synthetic-viewer",
            chatter_user_name: "Synthetic Viewer",
            message_id: "synthetic-twitch-hit-1",
            message: { text: "!hit water" },
          },
        },
      });
      await vi.waitFor(async () => {
        expect(
          (await app.app.inject({ method: "GET", url: "/battle/state" })).json(),
        ).toMatchObject({
          status: "active",
          currentHp: 86,
          acceptedHitCount: 1,
          weaknessHitCount: 1,
        });
      });

      expect(
        (await app.app.inject({ method: "POST", url: "/twitch/mock", headers: ownerHeaders }))
          .statusCode,
      ).toBe(200);
      const cancelledTwitch = (
        await app.app.inject({ method: "GET", url: "/battle/state" })
      ).json();
      expect(cancelledTwitch.status).toBe("cancelled");
      expect(cancelledTwitch.cancelReason).toMatch(
        /^(provider_changed|twitch_session_invalidated)$/u,
      );
      expect(cancelledTwitch.encounterId).toBe(twitchEncounterId);

      const nextMockForge = await finishForge();
      expect(nextMockForge).toMatchObject({ mode: "mock", status: "revealed", cycleId: "forge-1" });
      const nextMockReady = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      expect(nextMockReady.status).toBe("ready");
      expect(nextMockReady.encounterId).not.toBe(twitchEncounterId);
      expect(nextMockReady.encounterId).not.toBe(mockReady.encounterId);
      const nextMockStart = await startCurrentBattle(localHeaders);
      expect(nextMockStart.statusCode).toBe(200);
      expect(nextMockStart.json().status).toBe("active");
    } finally {
      await app.close();
    }
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
    const battleIdle = await restarted.app.inject({ method: "GET", url: "/battle/state" });
    expect(battleIdle.json()).toMatchObject({
      status: "idle",
      revision: 0,
      encounterId: null,
      serverInstanceId: "new-process",
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

  it("keeps Twitch diagnostics absent by default and owner-protected on same-origin POST", async () => {
    const absent = await server.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" },
      remoteAddress: "127.0.0.1",
    });
    expect(absent.statusCode).toBe(404);
    const getIsNotRegistered = await server.app.inject({
      method: "GET",
      url: "/dev/twitch/diagnostics",
      headers: { origin: "http://localhost:5173" },
      remoteAddress: "127.0.0.1",
    });
    expect(getIsNotRegistered.statusCode).toBe(404);

    const enabled = await createBossForgeApp({ mode: "development", eventSubDiagnostics: true });
    const unauthenticated = await enabled.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" },
      remoteAddress: "127.0.0.1",
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.headers["cache-control"]).toBeUndefined();
    await enabled.close();
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
    const eventSubTimers: Array<{
      callback: () => void;
      delayMs: number;
      cancelled: boolean;
    }> = [];
    let eventSubMonotonicMs = 0;
    const helixSessionIds: string[] = [];
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
        const requestBody = JSON.parse(String(init?.body)) as { transport: { session_id: string } };
        helixSessionIds.push(requestBody.transport.session_id);
        return new Response(
          JSON.stringify({
            data: [
              {
                type: "channel.chat.message",
                version: "1",
                status: "enabled",
                condition: { broadcaster_user_id: "12345", user_id: "12345" },
                transport: { session_id: requestBody.transport.session_id },
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
      eventSubDiagnostics: true,
      twitchOAuth: oauth,
      twitchFetch: mockFetch,
      twitchEventSubScheduler: {
        schedule(callback, delayMs) {
          const timer = { callback, delayMs, cancelled: false };
          eventSubTimers.push(timer);
          return () => {
            timer.cancelled = true;
          };
        },
      },
      twitchEventSubMonotonicNow: () => eventSubMonotonicMs,
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
    const initialTwitchForge = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    const twitchBattleRequest = {
      requestId: "00000000-0000-4000-8000-000000000201",
      expectedRevision: 0,
      forgeIdentity: {
        serverInstanceId: initialTwitchForge.serverInstanceId,
        serverStartedAt: initialTwitchForge.serverStartedAt,
        cycleId: "forge-1",
        mode: "twitch" as const,
      },
      forgeCycleId: "forge-1",
      durationSeconds: 90,
      audienceBand: "medium",
    };
    const battleWithoutOwner = await live.app.inject({
      method: "POST",
      url: "/dev/battle/start",
      headers: { origin, "sec-fetch-site": "same-origin" },
      remoteAddress: "127.0.0.1",
      payload: twitchBattleRequest,
    });
    expect(battleWithoutOwner.statusCode).toBe(401);
    expect(battleWithoutOwner.json()).toEqual({ error: "owner_auth_required" });
    const battleBeforeVerifiedWelcome = await live.app.inject({
      method: "POST",
      url: "/dev/battle/start",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
      payload: { ...twitchBattleRequest, requestId: "00000000-0000-4000-8000-000000000202" },
    });
    expect(battleBeforeVerifiedWelcome.statusCode).toBe(409);
    expect(battleBeforeVerifiedWelcome.json()).toEqual({ error: "provider_unverified" });
    const diagnosticsWithoutOwner = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin" },
      remoteAddress: "127.0.0.1",
    });
    expect(diagnosticsWithoutOwner.statusCode).toBe(401);
    const diagnosticsMissingOrigin = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(diagnosticsMissingOrigin.statusCode).toBe(403);
    const diagnosticsMissingFetchMetadata = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(diagnosticsMissingFetchMetadata.statusCode).toBe(403);
    const diagnosticsCrossSite = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "cross-site", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(diagnosticsCrossSite.statusCode).toBe(403);
    const diagnosticsInvalidSession = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
        cookie: "bossforge_twitch_session=invalid-session",
      },
      remoteAddress: "127.0.0.1",
    });
    expect(diagnosticsInvalidSession.statusCode).toBe(401);
    const diagnosticsNonLoopback = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "203.0.113.8",
    });
    expect(diagnosticsNonLoopback.statusCode).toBe(403);
    const getIsUnsupported = await live.app.inject({
      method: "GET",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(getIsUnsupported.statusCode).toBe(404);
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
    const forgeStateBeforeDiagnostics = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    const ownerDiagnostics = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(ownerDiagnostics.statusCode).toBe(200);
    expect(ownerDiagnostics.headers["cache-control"]).toBe("no-store");
    expect(ownerDiagnostics.json()).toMatchObject({
      counters: { rawFrames: 1, validWelcomes: 1, subscriptionAttempts: 1, subscriptionEnabled: 1 },
    });
    for (const sensitiveValue of [
      "live-session",
      "12345",
      "test-only-secret",
      "access-token",
      "refresh-token",
      "private chat message",
    ]) {
      expect(ownerDiagnostics.body).not.toContain(sensitiveValue);
    }
    const forgeStateAfterDiagnostics = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    expect(forgeStateAfterDiagnostics).toEqual(forgeStateBeforeDiagnostics);
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
    const secondStart = await live.app.inject({
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
    expect(secondStart.statusCode).toBe(200);
    const secondVotingState = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    expect(secondVotingState).toMatchObject({ status: "voting", connectedToTwitch: true });
    expect(reconciler.apply(secondVotingState, generation)).toBe(true);

    const liveAddress = await live.app.listen({ host: "127.0.0.1", port: 0 });
    const liveOrigin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    const dashboardSocket = new WebSocket(liveAddress.replace("http", "ws") + "/events/dashboard", {
      headers: { origin: liveOrigin },
    });
    const overlaySocket = new WebSocket(liveAddress.replace("http", "ws") + "/events/overlay", {
      headers: { origin: liveOrigin },
    });
    const outbound: string[] = [];
    dashboardSocket.on("message", (frame) => outbound.push(frame.toString()));
    overlaySocket.on("message", (frame) => outbound.push(frame.toString()));
    await Promise.all([once(dashboardSocket, "open"), once(overlaySocket, "open")]);
    const privateSentinels = [
      "987654321",
      "SENTINEL_TWITCH_VIEWER_9af2",
      "SENTINEL_TWITCH_MESSAGE_6b20",
      "SENTINEL_OAUTH_ACCESS_TOKEN_112a",
      "SENTINEL_SESSION_COOKIE_0f47",
      "SENTINEL_CLIENT_SECRET_c9d1",
      "SENTINEL_REJECTED_TWITCH_FRAME_48d0",
    ];
    sockets[0]!.sendFrame({
      metadata: {
        message_id: "eventsub-frame-id",
        message_type: "notification",
        message_timestamp: new Date().toISOString(),
        subscription_type: "channel.chat.message",
        subscription_version: "1",
      },
      payload: {
        subscription: {
          type: "channel.chat.message",
          version: "1",
          condition: { broadcaster_user_id: "12345", user_id: "12345" },
          cookie: privateSentinels[4],
        },
        event: {
          broadcaster_user_id: "12345",
          chatter_user_id: privateSentinels[0],
          chatter_user_login: "private_viewer",
          chatter_user_name: privateSentinels[1],
          message_id: privateSentinels[2],
          message: { text: "!vote body drake", access_token: privateSentinels[3] },
        },
        client_secret: privateSentinels[5],
      },
      oauth_access_token: privateSentinels[3],
    });
    sockets[0]!.sendFrame({
      metadata: {
        message_id: "SENTINEL_REJECTED_TWITCH_FRAME_48d0",
        message_type: "notification",
        message_timestamp: new Date().toISOString(),
        subscription_type: "channel.chat.message",
        subscription_version: "1",
      },
      payload: {
        subscription: {
          type: "channel.chat.message",
          version: "1",
          condition: { broadcaster_user_id: "12345", user_id: "12345" },
        },
        event: {
          broadcaster_user_id: "12345",
          chatter_user_id: "not-a-valid-viewer",
          chatter_user_login: "private_viewer",
          chatter_user_name: "RejectedViewer",
          message_id: "rejected-message",
          message: { text: "!vote body golem" },
        },
      },
    });
    await vi.waitFor(async () => {
      const stateResponse = await live.app.inject({ method: "GET", url: "/forge/state" });
      expect(stateResponse.json().categories[0].totalVotes).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 330));
    const liveSnapshot = await live.app.inject({ method: "GET", url: "/forge/state" });
    const liveDiagnostics = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin: liveOrigin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(liveDiagnostics.json().counters.normalizedRejected).toBeGreaterThan(0);
    const twitchSerialized = [...outbound, liveSnapshot.body, liveDiagnostics.body].join("\n");
    for (const sentinel of privateSentinels) expect(twitchSerialized).not.toContain(sentinel);
    expect(outbound.some((frame) => frame.includes("dashboard.activity"))).toBe(true);
    const dashboardClose = once(dashboardSocket, "close");
    const overlayClose = once(overlaySocket, "close");
    dashboardSocket.close();
    overlaySocket.close();
    await Promise.all([dashboardClose, overlayClose]);

    sockets[0]!.emit("close", 4006, Buffer.from("ignored close reason"));
    const droppedSocketState = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    expect(droppedSocketState).toMatchObject({
      mode: "twitch",
      connectedToTwitch: false,
      status: "idle",
    });
    expect(reconciler.apply(droppedSocketState, generation)).toBe(true);
    const droppedSocketStatus = await live.app.inject({
      method: "GET",
      url: "/twitch/status",
      remoteAddress: "127.0.0.1",
    });
    expect(droppedSocketStatus.json()).toMatchObject({ connected: false, status: "retry-wait" });
    const closeDiagnostics = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(closeDiagnostics.json()).toMatchObject({
      closeCodes: { "4006": 1 },
      disconnectReasons: { "socket-close": 1 },
      forgeCancellationReasons: { "socket-close": 1 },
      counters: { forgeCancellations: 1, socketCloses: 1 },
      lastDisconnect: { closeCode: 4006, reason: "socket-close" },
    });
    expect(closeDiagnostics.body).not.toContain("ignored close reason");
    const socketRetryTimer = eventSubTimers.find(
      (timer) => timer.delayMs === 500 && !timer.cancelled,
    )!;
    expect(socketRetryTimer).toBeDefined();
    socketRetryTimer.cancelled = true;
    socketRetryTimer.callback();
    expect(sockets).toHaveLength(2);
    sockets[1]!.sendFrame({
      metadata: {
        message_id: "reconnect-welcome-id",
        message_type: "session_welcome",
        message_timestamp: new Date().toISOString(),
      },
      payload: { session: { id: "reconnected-live-session", keepalive_timeout_seconds: 30 } },
    });
    await vi.waitFor(async () => {
      const status = await live.app.inject({
        method: "GET",
        url: "/twitch/status",
        remoteAddress: "127.0.0.1",
      });
      expect(status.json().connected).toBe(true);
    });
    expect(helixSessionIds).toEqual(["live-session", "reconnected-live-session"]);
    const reconnectedState = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(reconnectedState).toMatchObject({
      mode: "twitch",
      connectedToTwitch: true,
      status: "idle",
    });
    expect(reconciler.apply(reconnectedState, generation)).toBe(true);
    const thirdStart = await live.app.inject({
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
    expect(thirdStart.statusCode).toBe(200);
    expect(thirdStart.json()).toMatchObject({ status: "voting", connectedToTwitch: true });

    const keepaliveTimeout = eventSubTimers.findLast(
      (timer) => timer.delayMs === 30_000 && !timer.cancelled,
    )!;
    expect(keepaliveTimeout).toBeDefined();
    eventSubMonotonicMs = 30_000;
    keepaliveTimeout.cancelled = true;
    keepaliveTimeout.callback();
    const duringGrace = (await live.app.inject({ method: "GET", url: "/forge/state" })).json();
    expect(duringGrace).toMatchObject({
      mode: "twitch",
      connectedToTwitch: true,
      status: "voting",
    });
    const graceTimer = eventSubTimers.findLast(
      (timer) => timer.delayMs === 2_500 && !timer.cancelled,
    )!;
    expect(graceTimer).toBeDefined();
    eventSubMonotonicMs = 32_500;
    graceTimer.cancelled = true;
    graceTimer.callback();
    const timedOutTwitchState = (
      await live.app.inject({ method: "GET", url: "/forge/state" })
    ).json();
    expect(timedOutTwitchState).toMatchObject({
      mode: "twitch",
      connectedToTwitch: false,
      status: "idle",
    });
    expect(reconciler.apply(timedOutTwitchState, generation)).toBe(true);
    const disconnectedStatus = await live.app.inject({
      method: "GET",
      url: "/twitch/status",
      remoteAddress: "127.0.0.1",
    });
    expect(disconnectedStatus.json()).toMatchObject({ connected: false, status: "retry-wait" });
    const timeoutDiagnostics = await live.app.inject({
      method: "POST",
      url: "/dev/twitch/diagnostics",
      headers: { origin, "sec-fetch-site": "same-origin", cookie: sessionCookie },
      remoteAddress: "127.0.0.1",
    });
    expect(timeoutDiagnostics.json()).toMatchObject({
      disconnectReasons: { "keepalive-timeout": 1 },
      forgeCancellationReasons: { "keepalive-timeout": 1 },
      counters: { forgeCancellations: 2 },
      lastDisconnect: { reason: "keepalive-timeout", timeoutMs: 30_000 },
    });
    const retryTimer = eventSubTimers.find((timer) => timer.delayMs === 500 && !timer.cancelled)!;
    expect(retryTimer).toBeDefined();
    retryTimer.cancelled = true;
    retryTimer.callback();
    expect(sockets).toHaveLength(3);
    const retryingStatus = await live.app.inject({
      method: "GET",
      url: "/twitch/status",
      remoteAddress: "127.0.0.1",
    });
    expect(retryingStatus.json()).toMatchObject({ connected: false, status: "connecting" });
    expect(reconciler.apply(timedOutTwitchState, generation)).toBe(true);
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

  it("sends only strict public dashboard events and aggregate mock activity", async () => {
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const allowedOrigin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    expect(getAllowedViteOrigins().has(allowedOrigin)).toBe(true);
    const client = new WebSocket(address.replace("http", "ws") + "/events", {
      headers: { origin: allowedOrigin },
    });
    const received: string[] = [];
    client.on("message", (message) => received.push(message.toString()));
    await once(client, "open");
    await new Promise((resolve) => setTimeout(resolve, 25));
    const initial = received.slice(0, 3).map((frame) => JSON.parse(frame));
    expect(initial[0]).toMatchObject({
      type: "forge.state",
      schemaVersion: 1,
      payload: { kind: "forge.state", state: { status: "idle", mode: "mock" } },
    });
    expect(initial[1]).toMatchObject({
      type: "connection.status",
      schemaVersion: 1,
      payload: { kind: "connection.status", status: "connected" },
    });

    const response = await server.app.inject({ method: "POST", url: "/dev/simulation/next" });
    expect(response.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const output = received.slice(3).join("\n");
    expect(output).not.toContain("EmberFan");
    expect(output).not.toContain("mock-ember-01");
    expect(output).not.toContain("chat.event");
    for (const frame of received)
      expect(DashboardEventEnvelopeSchema.safeParse(JSON.parse(frame)).success).toBe(true);
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

  it("isolates dashboard and OBS wire contracts and never serializes private chat sentinels", async () => {
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const base = address.replace("http", "ws");
    const origin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    const dashboard = new WebSocket(`${base}/events/dashboard`, { headers: { origin } });
    const overlay = new WebSocket(`${base}/events/overlay?recipient=dashboard`, {
      headers: { origin },
    });
    const dashboardFrames: string[] = [];
    const overlayFrames: string[] = [];
    dashboard.on("message", (frame) => dashboardFrames.push(frame.toString()));
    overlay.on("message", (frame) => overlayFrames.push(frame.toString()));
    await Promise.all([once(dashboard, "open"), once(overlay, "open")]);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const started = await server.app.inject({
      method: "POST",
      url: "/dev/forge/start",
      payload: { durationSeconds: 15 },
    });
    expect(started.statusCode).toBe(200);
    const event = {
      kind: "chat.message",
      provider: "mock",
      oauth_token: "SENTINEL_MOCK_OAUTH_TOKEN_0c73",
      cookie: "SENTINEL_MOCK_COOKIE_23d9",
      provider_error: {
        message: "SENTINEL_PROVIDER_ERROR_OBJECT_40e1",
        secret: "SENTINEL_MOCK_SECRET_781b",
      },
      message: {
        id: "SENTINEL_MESSAGE_ID_80ac",
        viewer: { id: "SENTINEL_VIEWER_ID_d2a1", displayName: "SENTINEL_DISPLAY_491f" },
        text: "!vote body golem",
        occurredAt: "2026-10-26T12:00:00.000Z",
        access_token: "SENTINEL_NESTED_TOKEN_18cb",
      },
    };
    const malformed = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        kind: "chat.message",
        provider: "mock",
        message: { id: "malformed", text: "SENTINEL_MALFORMED_PRIVATE_TEXT_7d11" },
      },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).not.toContain("SENTINEL_MALFORMED_PRIVATE_TEXT_7d11");
    const accepted = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: event,
    });
    expect(accepted.statusCode).toBe(202);
    const replay = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: event,
    });
    expect(replay.statusCode).toBe(202);
    await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      payload: {
        ...event,
        message: {
          ...event.message,
          id: "SENTINEL_PRIVATE_MESSAGE_f283",
          text: "SENTINEL_PRIVATE_CHAT_4a90",
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 350));

    const snapshot = await server.app.inject({ method: "GET", url: "/forge/state" });
    const overlayBattleSnapshot = await server.app.inject({
      method: "GET",
      url: "/battle/overlay-state",
    });
    expect(overlayBattleSnapshot.statusCode).toBe(200);
    expect(OverlayBattleStateV1Schema.safeParse(overlayBattleSnapshot.json()).success).toBe(true);
    const serialized = [
      ...dashboardFrames,
      ...overlayFrames,
      snapshot.body,
      overlayBattleSnapshot.body,
      started.body,
    ].join("\n");
    for (const sentinel of [
      "SENTINEL_MESSAGE_ID_80ac",
      "SENTINEL_VIEWER_ID_d2a1",
      "SENTINEL_DISPLAY_491f",
      "SENTINEL_PRIVATE_CHAT_4a90",
      "SENTINEL_MOCK_OAUTH_TOKEN_0c73",
      "SENTINEL_MOCK_COOKIE_23d9",
      "SENTINEL_PROVIDER_ERROR_OBJECT_40e1",
      "SENTINEL_MOCK_SECRET_781b",
      "SENTINEL_NESTED_TOKEN_18cb",
    ])
      expect(serialized).not.toContain(sentinel);
    expect(snapshot.headers["cache-control"]).toContain("no-store");
    expect(snapshot.json().categories[0].totalVotes).toBe(1);
    const dash = dashboardFrames.map((frame) => JSON.parse(frame));
    const obs = overlayFrames.map((frame) => JSON.parse(frame));
    const aggregateFrames = dash.filter((envelope) => envelope.type === "dashboard.activity");
    for (const envelope of dash)
      expect(DashboardEventEnvelopeSchema.safeParse(envelope).success).toBe(true);
    for (const envelope of obs)
      expect(OverlayEventEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(aggregateFrames.length).toBeGreaterThan(0);
    for (const envelope of aggregateFrames) {
      const aggregateIndex = dash.indexOf(envelope);
      const previousState = dash
        .slice(0, aggregateIndex)
        .filter((candidate) => candidate.type === "forge.state")
        .at(-1);
      expect(previousState).toBeDefined();
      expect(envelope.payload.serverInstanceId).toBe(previousState?.payload.state.serverInstanceId);
      expect(envelope.payload.cycleId).toBe(previousState?.payload.state.cycleId);
    }
    expect(
      dash.some(
        (envelope) => envelope.type === "dashboard.activity" && envelope.payload.accepted === 1,
      ),
    ).toBe(true);
    expect(
      dash.some(
        (envelope) => envelope.type === "dashboard.activity" && envelope.payload.rejected === 2,
      ),
    ).toBe(true);
    expect(obs.some((envelope) => envelope.type === "dashboard.activity")).toBe(false);
    const reset = await server.app.inject({ method: "POST", url: "/dev/forge/reset" });
    expect(reset.statusCode).toBe(200);
    expect(reset.body).not.toContain("SENTINEL_");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      dashboardFrames
        .map((frame) => JSON.parse(frame))
        .some(
          (envelope) =>
            envelope.type === "dashboard.activity" &&
            envelope.payload.accepted === 0 &&
            envelope.payload.rejected === 0,
        ),
    ).toBe(true);
    dashboard.close();
    overlay.close();
    await Promise.all([once(dashboard, "close"), once(overlay, "close")]);
  });

  it("keeps initial connection state targeted to its subscribing recipient", async () => {
    const address = await server.app.listen({ host: "127.0.0.1", port: 0 });
    const origin = `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`;
    const overlay = new WebSocket(address.replace("http", "ws") + "/events/overlay", {
      headers: { origin },
    });
    const overlayFrames: string[] = [];
    overlay.on("message", (frame) => overlayFrames.push(frame.toString()));
    await once(overlay, "open");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const dashboard = new WebSocket(
      address.replace("http", "ws") + "/events/dashboard?recipient=overlay",
      { headers: { origin } },
    );
    const dashboardFrames: string[] = [];
    dashboard.on("message", (frame) => dashboardFrames.push(frame.toString()));
    await once(dashboard, "open");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(overlayFrames).toHaveLength(3);
    expect(dashboardFrames).toHaveLength(4);
    expect(dashboardFrames.some((frame) => frame.includes("dashboard.activity"))).toBe(true);
    expect(overlayFrames.some((frame) => frame.includes("battle.state"))).toBe(true);
    expect(dashboardFrames.some((frame) => frame.includes("battle.state"))).toBe(true);
    const overlayClose = once(overlay, "close");
    const dashboardClose = once(dashboard, "close");
    overlay.close();
    dashboard.close();
    await Promise.all([overlayClose, dashboardClose]);
  });

  it("logs only fixed error classifications and returns sanitized parser failures", async () => {
    const warn = vi.spyOn(server.app.log, "warn");
    const response = await server.app.inject({
      method: "POST",
      url: "/dev/simulation/events",
      headers: { "content-type": "application/json" },
      payload: '{"message":"SENTINEL_FULL_PROVIDER_ERROR_2c11"',
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain("SENTINEL_FULL_PROVIDER_ERROR_2c11");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SENTINEL_FULL_PROVIDER_ERROR_2c11");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SyntaxError");
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ classification: "request-rejected" });
    expect(warn.mock.calls[0]?.[0]).not.toHaveProperty("err");
    warn.mockRestore();
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
    expect(
      (await production.app.inject({ method: "POST", url: "/dev/battle/start" })).statusCode,
    ).toBe(404);
    expect(
      (await production.app.inject({ method: "POST", url: "/dev/battle/damage" })).statusCode,
    ).toBe(404);
    await production.close();
  });
});
