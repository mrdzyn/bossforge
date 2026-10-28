import { randomUUID } from "node:crypto";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type WebSocket from "ws";
import { ForgeStartRequestSchema, type ForgeState } from "@bossforge/shared";
import { MockChatAdapter } from "./adapters/mock-chat-adapter.js";
import { EventHub, toPublicForgeState } from "./events/event-hub.js";
import { NormalizedChatEventSchema } from "./events/normalized-chat-event.js";
import {
  getAllowedViteOrigins,
  isAllowedLocalMutationRequest,
  isAllowedViteOrigin,
  isLoopbackAddress,
} from "./security/local-access.js";
import { createRateLimit } from "./security/rate-limit.js";
import { ForgeSession, type ForgeScheduler } from "./forge/forge-session.js";
import { TwitchOAuth } from "./twitch/oauth.js";
import { LiveEventSub, type LiveEventSubStatus } from "./twitch/live-eventsub.js";
import type { EventSubScheduler } from "./twitch/eventsub-session.js";
import {
  EventSubDiagnostics,
  type ForgeCancellationReason,
} from "./twitch/eventsub-diagnostics.js";

const packageVersion = "0.1.0";
const bodyLimitBytes = 8 * 1024;

function processMode(value: string | undefined): NonNullable<AppOptions["mode"]> {
  if (value === "development" || value === "production" || value === "test") return value;
  return "test";
}

export interface AppOptions {
  mode?: "development" | "production" | "test";
  simulationEnabled?: boolean;
  now?: () => Date;
  forgeScheduler?: ForgeScheduler;
  serverInstanceId?: string;
  serverStartedAt?: string;
  twitchOAuth?: TwitchOAuth;
  twitchFetch?: typeof fetch;
  twitchCreateSocket?: (url: string) => WebSocket;
  twitchEventSubScheduler?: EventSubScheduler;
  twitchEventSubMonotonicNow?: () => number;
  eventSubDiagnostics?: boolean;
}

export interface BossForgeApp {
  app: FastifyInstance;
  close(): Promise<void>;
}

export async function createBossForgeApp(options: AppOptions = {}): Promise<BossForgeApp> {
  const mode = options.mode ?? processMode(process.env.NODE_ENV);
  const developmentMode = mode === "development";
  const simulationEnabled = developmentMode && options.simulationEnabled !== false;
  const now = options.now ?? (() => new Date());
  const mockAdapter = new MockChatAdapter(now);
  const hub = new EventHub();
  const diagnosticsEnabled =
    developmentMode &&
    (options.eventSubDiagnostics ?? process.env.BOSSFORGE_EVENTSUB_DIAGNOSTICS === "true");
  const eventSubDiagnostics = diagnosticsEnabled ? new EventSubDiagnostics() : undefined;
  let provider: "mock" | "twitch" = "mock";
  let liveEventSub: LiveEventSub | undefined;
  let activity = {
    accepted: 0,
    rejected: 0,
    reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
  };
  let activityTimer: ReturnType<typeof setTimeout> | undefined;
  let activityServerInstanceId: string | null = null;
  let activityCycleId: string | null = null;
  const activityForState = (state: ForgeState) => ({
    serverInstanceId: state.serverInstanceId,
    cycleId: state.cycleId,
    accepted: activity.accepted,
    rejected: activity.rejected,
    reasons: { ...activity.reasons },
  });
  const resetActivity = (cycleId: string | null) => {
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = undefined;
    activityCycleId = cycleId;
    activity = {
      accepted: 0,
      rejected: 0,
      reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
    };
  };
  const sendActivity = () => {
    activityTimer = undefined;
    hub.publishDashboard(activityForState(forge.getState()));
  };
  const recordBallot = (reason: import("./twitch/eventsub-diagnostics.js").ForgeBallotReason) => {
    if (reason === "accepted") activity.accepted = Math.min(10_000, activity.accepted + 1);
    else {
      activity.rejected = Math.min(10_000, activity.rejected + 1);
      const group =
        reason === "duplicate-message" || reason === "unchanged-choice"
          ? "duplicate"
          : reason === "inactive-voting" || reason === "disconnected"
            ? "inactive"
            : reason === "invalid-choice" ||
                reason === "invalid-timestamp" ||
                reason === "invalid-viewer"
              ? "invalid"
              : "other";
      activity.reasons[group] = Math.min(10_000, activity.reasons[group] + 1);
    }
    if (!activityTimer)
      activityTimer = setTimeout(() => {
        activityTimer = undefined;
        sendActivity();
      }, 300);
  };
  const publishForgeState = (state: ForgeState, source: "mock" | "twitch") => {
    let reset = false;
    if (state.serverInstanceId !== activityServerInstanceId) {
      activityServerInstanceId = state.serverInstanceId;
      resetActivity(state.cycleId);
      reset = true;
    } else if (state.status === "voting" && state.cycleId !== activityCycleId) {
      resetActivity(state.cycleId);
      reset = true;
    } else if (state.status === "idle" && activityCycleId !== null) {
      resetActivity(null);
      reset = true;
    }
    const payload = { kind: "forge.state" as const, source, state };
    hub.publishDashboard(payload);
    hub.publishOverlay(payload);
    if (reset) hub.publishDashboard(activityForState(state));
  };
  const publishConnection = (
    source: "mock" | "twitch",
    status: "connecting" | "connected" | "disconnected" | "error",
  ) => {
    const payload = { kind: "connection.status" as const, source, status };
    hub.publishDashboard(payload);
    hub.publishOverlay(payload);
  };
  const initialConnection = () => {
    if (provider === "mock") return { source: "mock" as const, status: mockAdapter.status };
    const status = liveEventSub?.status;
    return {
      source: "twitch" as const,
      status: liveEventSub?.connected
        ? ("connected" as const)
        : status === "connecting" ||
            status === "reconnecting" ||
            status === "retry-wait" ||
            status === "subscribing"
          ? ("connecting" as const)
          : status === "failed" || status === "revoked"
            ? ("error" as const)
            : ("disconnected" as const),
    };
  };
  const serverInstanceId = options.serverInstanceId ?? randomUUID();
  let forgeEpoch = Date.parse(options.serverStartedAt ?? new Date().toISOString());
  let forgeStartedAt = new Date(forgeEpoch).toISOString();
  let forgeGeneration = 0;
  const createForge = (mode: "mock" | "twitch", connected = false) => {
    resetActivity(null);
    if (forgeGeneration > 0) {
      forgeEpoch = Math.max(now().getTime(), forgeEpoch + 1);
      forgeStartedAt = new Date(forgeEpoch).toISOString();
    }
    const instanceId = forgeGeneration++ === 0 ? serverInstanceId : randomUUID();
    return new ForgeSession(
      now,
      options.forgeScheduler,
      (state) => publishForgeState(state, mode),
      instanceId,
      forgeStartedAt,
      mode,
      connected,
      (reason) => {
        recordBallot(reason);
        if (mode === "twitch") eventSubDiagnostics?.recordBallot(reason);
      },
    );
  };
  let forge = createForge("mock");
  const oauth =
    options.twitchOAuth ??
    new TwitchOAuth({
      clientId: process.env.TWITCH_CLIENT_ID ?? "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET ?? "",
      redirectUri: "http://localhost:3001/auth/twitch/callback",
      enabled: process.env.TWITCH_INTEGRATION_ENABLED === "true" && developmentMode,
      ...(options.twitchFetch ? { fetch: options.twitchFetch } : {}),
      onSessionInvalidated: () => {
        liveEventSub?.shutdown();
        liveEventSub = undefined;
        if (provider === "twitch") forge.setTwitchConnected(false);
      },
    });
  const app = Fastify({ logger: false, bodyLimit: bodyLimitBytes });
  const allowedViteOrigins = getAllowedViteOrigins();

  const requireLocalDevelopmentRequest = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!developmentMode || !isLoopbackAddress(request.raw.socket.remoteAddress)) {
      reply.code(403).send({ error: "Local development access only" });
      return;
    }
    if (
      !isAllowedLocalMutationRequest(
        request.headers.origin,
        request.headers["sec-fetch-site"],
        allowedViteOrigins,
      )
    ) {
      reply.code(403).send({ error: "Local simulation origin is not allowed" });
    }
  };

  const requireLocalWebSocketOrigin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!developmentMode || !isLoopbackAddress(request.raw.socket.remoteAddress)) {
      reply.code(403).send({ error: "Local development access only" });
      return;
    }
    if (!isAllowedViteOrigin(request.headers.origin, allowedViteOrigins)) {
      reply.code(403).send({ error: "WebSocket origin is not allowed" });
    }
  };

  const requestIsLocal = (request: FastifyRequest): boolean =>
    developmentMode && isLoopbackAddress(request.raw.socket.remoteAddress);
  const cookie = (request: FastifyRequest, name: string): string | undefined => {
    const header = request.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === name) return decodeURIComponent(rest.join("="));
    }
    return undefined;
  };
  const requireTwitchOwner = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!requestIsLocal(request)) {
      reply.code(403).send({ error: "Local development access only" });
      return;
    }
    if (
      !isAllowedViteOrigin(request.headers.origin, allowedViteOrigins) ||
      request.headers.origin === undefined ||
      (request.headers["sec-fetch-site"] !== undefined &&
        request.headers["sec-fetch-site"] !== "same-origin")
    ) {
      reply.code(403).send({ error: "Twitch control origin is not allowed" });
      return;
    }
    if (!oauth.identityFor(cookie(request, "bossforge_twitch_session")))
      reply.code(401).send({ error: "Twitch streamer authorization required" });
  };
  const requireSameOriginTwitchOwnerPost = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!requestIsLocal(request)) {
      reply.code(403).send({ error: "Local development access only" });
      return;
    }
    if (
      request.method !== "POST" ||
      !isAllowedViteOrigin(request.headers.origin, allowedViteOrigins) ||
      request.headers.origin === undefined ||
      request.headers["sec-fetch-site"] !== "same-origin"
    ) {
      reply.code(403).send({ error: "Twitch control origin is not allowed" });
      return;
    }
    if (!oauth.identityFor(cookie(request, "bossforge_twitch_session")))
      reply.code(401).send({ error: "Twitch streamer authorization required" });
  };
  const secureLocalAuthRequest = (request: FastifyRequest): boolean =>
    requestIsLocal(request) && request.headers.host === "localhost:3001";
  const twitchStatus = () => ({
    configured: oauth.configured,
    mode: provider,
    identity: oauth.identityFor(undefined) ?? null,
    connected: liveEventSub?.connected ?? false,
    status: liveEventSub?.status ?? "disconnected",
  });

  await app.register(websocket, { options: { maxPayload: bodyLimitBytes } });

  app.get("/health", async () => ({
    status: "ok",
    service: "bossforge-server",
    version: packageVersion,
    timestamp: now().toISOString(),
    connections: { websocketClients: hub.clientCount, mockAdapter: mockAdapter.status },
  }));

  if (developmentMode) {
    app.get("/auth/twitch", async (request, reply) => {
      if (!secureLocalAuthRequest(request))
        return reply.code(403).send({ error: "Local Twitch authorization only" });
      try {
        const start = oauth.begin();
        reply.header(
          "set-cookie",
          `bossforge_twitch_state=${encodeURIComponent(start.stateCookie)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`,
        );
        reply.header("cache-control", "no-store");
        reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
        return reply.redirect(start.authorizeUrl);
      } catch {
        return reply.code(503).send({ error: "Twitch integration is not configured" });
      }
    });

    app.get("/auth/twitch/callback", async (request, reply) => {
      if (!secureLocalAuthRequest(request))
        return reply.code(403).send({ error: "Local Twitch callback only" });
      const params = new URL(request.url, "http://localhost:3001").searchParams;
      const states = params.getAll("state");
      const codes = params.getAll("code");
      const denied = params.getAll("error").length > 0;
      const clearState = "bossforge_twitch_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
      reply.header("cache-control", "no-store");
      reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
      if (denied || states.length !== 1 || codes.length !== 1) {
        if (states.length === 1) oauth.cancel(states[0]!);
        reply.header("set-cookie", clearState);
        return reply.code(400).send({ error: "Twitch authorization was denied or invalid" });
      }
      try {
        const login = await oauth.complete(
          states[0]!,
          cookie(request, "bossforge_twitch_state") ?? "",
          codes[0]!,
        );
        reply.header("set-cookie", [
          clearState,
          `bossforge_twitch_session=${encodeURIComponent(login.sessionCookie)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
        ]);
        return reply.redirect(
          `http://localhost:${process.env.VITE_PORT ?? "5173"}/?twitch=authorized`,
        );
      } catch {
        reply.header("set-cookie", clearState);
        return reply.code(400).send({ error: "Twitch authorization could not be verified" });
      }
    });

    app.get("/twitch/status", { onRequest: requireLocalDevelopmentRequest }, async (request) => ({
      ...twitchStatus(),
      identity: oauth.identityFor(cookie(request, "bossforge_twitch_session")) ?? null,
    }));

    app.post("/twitch/connect", { onRequest: requireTwitchOwner }, async (request, reply) => {
      const sessionCookie = cookie(request, "bossforge_twitch_session");
      const identity = oauth.identityFor(sessionCookie);
      if (!sessionCookie || !identity)
        return reply.code(401).send({ error: "Twitch login required" });
      if (liveEventSub?.connected)
        return reply.code(409).send({ error: "Twitch connection is already active" });
      liveEventSub?.shutdown();
      liveEventSub = undefined;
      provider = "twitch";
      forge.close();
      forge = createForge("twitch", false);
      publishForgeState(forge.getState(), "twitch");
      liveEventSub = new LiveEventSub({
        clientId: process.env.TWITCH_CLIENT_ID ?? "",
        identity,
        getAccessToken: () => oauth.accessToken(sessionCookie),
        refreshAccessToken: () => oauth.refreshAccessToken(sessionCookie),
        ...(options.twitchFetch ? { fetch: options.twitchFetch } : {}),
        ...(options.twitchCreateSocket ? { createSocket: options.twitchCreateSocket } : {}),
        ...(options.twitchEventSubScheduler ? { scheduler: options.twitchEventSubScheduler } : {}),
        ...(options.twitchEventSubMonotonicNow
          ? { monotonicNow: options.twitchEventSubMonotonicNow }
          : {}),
        ...(eventSubDiagnostics ? { diagnostics: eventSubDiagnostics } : {}),
        onChat: (event) => {
          if (provider !== "twitch") return;
          forge.handleEvent(event);
        },
        onStatus: (status: LiveEventSubStatus, connected) => {
          if (provider !== "twitch") return;
          if (!connected && forge.getState().status === "voting" && eventSubDiagnostics) {
            const reason: ForgeCancellationReason =
              status === "failed"
                ? "subscription-failed"
                : status === "stopped"
                  ? "stopped"
                  : status === "revoked"
                    ? "revoked"
                    : (eventSubDiagnostics.snapshot().lastDisconnect?.reason ??
                      "transport-unknown");
            eventSubDiagnostics.recordForgeCancellation(reason);
          }
          if (connected && forge.getState().mode !== "twitch") forge = createForge("twitch", true);
          if (forge.getState().mode === "twitch") forge.setTwitchConnected(connected);
          publishConnection(
            "twitch",
            connected
              ? "connected"
              : status === "failed" || status === "revoked"
                ? "error"
                : status === "stopped"
                  ? "disconnected"
                  : status === "retry-wait"
                    ? "disconnected"
                    : "connecting",
          );
        },
      });
      liveEventSub.start();
      return reply.code(202).send({ accepted: true, status: liveEventSub.status, mode: "twitch" });
    });

    app.post("/twitch/disconnect", { onRequest: requireTwitchOwner }, async (request, reply) => {
      const sessionCookie = cookie(request, "bossforge_twitch_session");
      liveEventSub?.shutdown();
      liveEventSub = undefined;
      await oauth.logout(sessionCookie);
      if (provider === "twitch") {
        forge.close();
        provider = "mock";
        forge = createForge("mock");
        publishForgeState(forge.getState(), "mock");
      }
      reply.header(
        "set-cookie",
        "bossforge_twitch_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      );
      return { disconnected: true, mode: provider };
    });

    app.post("/twitch/mock", { onRequest: requireTwitchOwner }, async () => {
      liveEventSub?.shutdown();
      liveEventSub = undefined;
      forge.close();
      provider = "mock";
      forge = createForge("mock");
      publishForgeState(forge.getState(), "mock");
      return { mode: provider, status: "disconnected" };
    });
  }

  const subscribe = (recipient: "dashboard" | "overlay") => (socket: WebSocket) => {
    if (recipient === "dashboard") {
      hub.addDashboardClient(socket);
      const state = forge.getState();
      hub.sendDashboard(socket, { kind: "forge.state", source: provider, state });
      const connection = initialConnection();
      hub.sendDashboard(socket, { kind: "connection.status", ...connection });
      hub.sendDashboard(socket, activityForState(state));
    } else {
      hub.addOverlayClient(socket);
      hub.sendOverlay(socket, { kind: "forge.state", source: provider, state: forge.getState() });
      hub.sendOverlay(socket, { kind: "connection.status", ...initialConnection() });
    }
  };
  app.get(
    "/events/dashboard",
    { websocket: true, onRequest: requireLocalWebSocketOrigin },
    subscribe("dashboard"),
  );
  app.get(
    "/events/overlay",
    { websocket: true, onRequest: requireLocalWebSocketOrigin },
    subscribe("overlay"),
  );
  // Compatibility path is pinned to the dashboard DTO family. It can never
  // serialize normalized chat or select a recipient through client input.
  app.get(
    "/events",
    { websocket: true, onRequest: requireLocalWebSocketOrigin },
    subscribe("dashboard"),
  );

  app.setErrorHandler((error, request, reply) => {
    let statusCode = 500;
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400
    ) {
      statusCode = error.statusCode;
    }
    request.log.warn(
      { statusCode, classification: statusCode >= 500 ? "server-error" : "request-rejected" },
      "Request rejected",
    );
    void reply
      .status(statusCode)
      .send({ error: statusCode >= 500 ? "Internal server error" : "Invalid request" });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: "Not found" });
  });

  if (simulationEnabled) {
    await mockAdapter.connect();
    const simulationRateLimit = createRateLimit({
      limit: 20,
      windowMs: 60_000,
      now: () => now().getTime(),
    });
    app.get(
      "/forge/state",
      { onRequest: requireLocalDevelopmentRequest },
      async (_request, reply) => {
        reply.header("cache-control", "no-store");
        return toPublicForgeState(forge.getState());
      },
    );
    if (eventSubDiagnostics) {
      app.post(
        "/dev/twitch/diagnostics",
        { onRequest: requireSameOriginTwitchOwnerPost },
        async (_request, reply) => {
          reply.header("cache-control", "no-store");
          return eventSubDiagnostics.snapshot();
        },
      );
    }
    app.post(
      "/dev/forge/start",
      {
        onRequest: requireLocalDevelopmentRequest,
        preHandler: [
          simulationRateLimit,
          async (request, reply) => {
            if (provider === "twitch") await requireTwitchOwner(request, reply);
          },
        ],
      },
      async (request, reply) => {
        const parsed = ForgeStartRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) return reply.status(400).send({ error: "Invalid forge settings" });
        if (provider === "twitch" && !forge.getState().connectedToTwitch)
          return reply.status(409).send({ error: "Twitch EventSub is not connected" });
        try {
          return toPublicForgeState(forge.start(parsed.data.durationSeconds));
        } catch {
          return reply.status(409).send({ error: "A forge cycle is already active" });
        }
      },
    );
    app.post(
      "/dev/forge/reset",
      {
        onRequest: requireLocalDevelopmentRequest,
        preHandler: [
          simulationRateLimit,
          async (request, reply) => {
            if (provider === "twitch") await requireTwitchOwner(request, reply);
          },
        ],
      },
      async (_request, reply) => {
        if (forge.getState().status === "idle")
          return reply.status(409).send({ error: "No active forge cycle" });
        return toPublicForgeState(forge.reset());
      },
    );
    app.post(
      "/dev/simulation/next",
      { onRequest: requireLocalDevelopmentRequest, preHandler: simulationRateLimit },
      async (_request, reply) => {
        if (provider === "twitch")
          return reply.status(403).send({ error: "Mock simulation is disabled in Twitch mode" });
        const event = mockAdapter.nextEvent();
        if (!event) return reply.status(204).send();
        forge.handleEvent(event);
        return reply.status(202).send({ accepted: true, kind: event.kind });
      },
    );

    app.post(
      "/dev/simulation/events",
      { onRequest: requireLocalDevelopmentRequest, preHandler: simulationRateLimit },
      async (request, reply) => {
        if (provider === "twitch")
          return reply.status(403).send({ error: "Mock simulation is disabled in Twitch mode" });
        const parsed = NormalizedChatEventSchema.safeParse(request.body);
        if (!parsed.success || parsed.data.provider !== "mock") {
          return reply.status(400).send({ error: "Invalid mock simulation event" });
        }
        forge.handleEvent(parsed.data);
        return reply.status(202).send({ accepted: true, kind: parsed.data.kind });
      },
    );
  }

  return {
    app,
    close: async () => {
      await mockAdapter.disconnect();
      if (activityTimer) clearTimeout(activityTimer);
      forge.close();
      liveEventSub?.shutdown();
      oauth.close();
      await app.close();
    },
  };
}
