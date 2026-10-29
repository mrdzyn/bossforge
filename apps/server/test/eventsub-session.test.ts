import { describe, expect, it } from "vitest";
import {
  EventSubSession,
  KEEPALIVE_TIMEOUT_GRACE_MS,
  type EventSubScheduler,
  type EventSubTransport,
  type EventSubTransportHandlers,
  type SubscriptionPlan,
} from "../src/twitch/eventsub-session.js";
import { EventSubDiagnostics } from "../src/twitch/eventsub-diagnostics.js";

type FakeSocket = {
  url: string;
  handlers: EventSubTransportHandlers;
  closed: boolean;
  pongs: number;
};

function harness(
  options: {
    maxRetries?: number;
    acceptNotification?: (message: unknown) => boolean;
    diagnostics?: EventSubDiagnostics;
    monotonicNow?: () => number;
  } = {},
) {
  const timers: Array<{ callback: () => void; delayMs: number; cancelled: boolean }> = [];
  const sockets: FakeSocket[] = [];
  const notifications: unknown[] = [];
  const plans: Array<{ sessionId: string; plan: SubscriptionPlan }> = [];
  const scheduler: EventSubScheduler = {
    schedule(callback, delayMs) {
      const timer = { callback, delayMs, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  };
  const session = new EventSubSession({
    initialUrl: "wss://fixtures.invalid/eventsub",
    createTransport(url, handlers): EventSubTransport {
      const socket = { url, handlers, closed: false, pongs: 0 };
      sockets.push(socket);
      return {
        close: () => {
          socket.closed = true;
        },
        pong: () => {
          socket.pongs += 1;
        },
      };
    },
    onNotification: (message) => {
      const accepted = options.acceptNotification?.(message) ?? true;
      if (accepted) notifications.push(message);
      return accepted;
    },
    onSubscriptionPlan: (sessionId, plan) => plans.push({ sessionId, plan }),
    scheduler,
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    ...(options.monotonicNow ? { monotonicNow: options.monotonicNow } : {}),
    maxRetries: options.maxRetries ?? 2,
    baseRetryDelayMs: 10,
  });
  const fireNextTimer = () => {
    const timer = timers.find((candidate) => !candidate.cancelled);
    if (!timer) throw new Error("No active timer");
    timer.cancelled = true;
    timer.callback();
  };
  const send = (socket: FakeSocket, message: unknown) =>
    socket.handlers.message(JSON.stringify(message));
  const welcome = (socket: FakeSocket, id: string, sessionId = "session-1") =>
    send(socket, {
      metadata: {
        message_id: id,
        message_type: "session_welcome",
        message_timestamp: "2026-10-26T12:00:00.000Z",
      },
      payload: { session: { id: sessionId, keepalive_timeout_seconds: 30 } },
    });
  return { session, timers, sockets, notifications, plans, fireNextTimer, send, welcome };
}

const message = (id: string, type: string, payload: unknown = {}) => ({
  metadata: {
    message_id: id,
    message_type: type,
    message_timestamp: "2026-10-26T12:00:00.000Z",
  },
  payload,
});

describe("offline injected EventSub lifecycle", () => {
  it("requires secure WebSocket URLs and bounded retry configuration", () => {
    expect(
      () =>
        new EventSubSession({
          initialUrl: "http://fixtures.invalid/eventsub",
          createTransport: () => ({ close: () => undefined }),
          onNotification: () => undefined,
        }),
    ).toThrow("credential-free wss URL");
    expect(
      () =>
        new EventSubSession({
          initialUrl: "wss://fixtures.invalid/eventsub",
          createTransport: () => ({ close: () => undefined }),
          onNotification: () => undefined,
          maxRetries: 11,
        }),
    ).toThrow("between 0 and 10");
  });

  it("handles welcome, keepalive, notifications, control ping/pong and replay protection", () => {
    const h = harness();
    h.session.start();
    expect(h.session.status).toBe("connecting");
    const socket = h.sockets[0]!;
    h.send(socket, message("early-notification", "notification", { event: { text: "early" } }));
    expect(h.notifications).toHaveLength(0);
    expect(h.session.status).toBe("connecting");
    h.welcome(socket, "welcome-1");
    expect(h.session.status).toBe("connected");
    expect(h.plans).toEqual([{ sessionId: "session-1", plan: "initial" }]);

    const notification = message("notification-1", "notification", { event: { text: "hello" } });
    const deadlineBeforeNotification = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    h.send(socket, notification);
    expect(deadlineBeforeNotification.cancelled).toBe(true);
    expect(h.timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    h.send(socket, notification);
    expect(h.notifications).toEqual([notification]);
    h.send(socket, message("keepalive-1", "session_keepalive"));
    socket.handlers.ping();
    expect(socket.pongs).toBe(1);
    expect(h.session.status).toBe("connected");
  });

  it("honors a valid server reconnect URL and keeps the old transport until welcome", () => {
    const h = harness();
    h.session.start();
    const oldSocket = h.sockets[0]!;
    h.welcome(oldSocket, "welcome-old", "old-session");
    const oldKeepaliveTimer = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    const reconnectUrl = "wss://fixtures.invalid/eventsub?session_id=preserve-me";
    h.send(
      oldSocket,
      message("reconnect-1", "session_reconnect", { session: { reconnect_url: reconnectUrl } }),
    );
    expect(h.session.status).toBe("reconnecting");
    expect(h.sockets[1]?.url).toBe(reconnectUrl);
    expect(oldSocket.closed).toBe(false);
    h.send(
      h.sockets[1]!,
      message("pending-notification", "notification", { event: { text: "too early" } }),
    );
    expect(h.notifications).toHaveLength(0);
    h.send(
      oldSocket,
      message("old-active-notification", "notification", { event: { text: "current" } }),
    );
    expect(h.notifications).toHaveLength(1);
    h.welcome(h.sockets[1]!, "welcome-new", "new-session");
    expect(oldSocket.closed).toBe(true);
    expect(h.session.status).toBe("connected");
    oldKeepaliveTimer.callback();
    expect(h.session.status).toBe("connected");
    expect(h.plans).toEqual([
      { sessionId: "old-session", plan: "initial" },
      { sessionId: "new-session", plan: "handoff" },
    ]);
    oldSocket.handlers.message(
      JSON.stringify(message("late-old-socket", "notification", { event: { text: "stale" } })),
    );
    expect(h.notifications).toHaveLength(1);
  });

  it("does not schedule a competing retry if the old socket drops during reconnect", () => {
    const h = harness();
    h.session.start();
    const oldSocket = h.sockets[0]!;
    h.welcome(oldSocket, "welcome-old");
    h.send(
      oldSocket,
      message("reconnect-1", "session_reconnect", {
        session: { reconnect_url: "wss://fixtures.invalid/eventsub" },
      }),
    );
    oldSocket.handlers.disconnect();
    expect(h.session.status).toBe("reconnecting");
    expect(h.timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    h.welcome(h.sockets[1]!, "welcome-new", "new-session");
    expect(h.session.status).toBe("connected");
    expect(h.plans).toEqual([
      { sessionId: "session-1", plan: "initial" },
      { sessionId: "new-session", plan: "handoff" },
    ]);
    h.sockets[1]!.handlers.disconnect();
    expect(h.session.status).toBe("retry-wait");
  });

  it("closes an earlier pending reconnect socket when Twitch sends a newer reconnect URL", () => {
    const h = harness();
    h.session.start();
    const active = h.sockets[0]!;
    h.welcome(active, "welcome-active");
    h.send(
      active,
      message("reconnect-a", "session_reconnect", {
        session: { reconnect_url: "wss://fixtures.invalid/eventsub?attempt=a" },
      }),
    );
    const orphanCandidate = h.sockets[1]!;
    h.send(
      active,
      message("reconnect-b", "session_reconnect", {
        session: { reconnect_url: "wss://fixtures.invalid/eventsub?attempt=b" },
      }),
    );
    expect(orphanCandidate.closed).toBe(true);
    expect(h.sockets).toHaveLength(3);
    expect(h.sockets[2]?.url).toBe("wss://fixtures.invalid/eventsub?attempt=b");
    h.welcome(h.sockets[2]!, "welcome-b", "replacement-session");
    expect(active.closed).toBe(true);
    expect(h.session.status).toBe("connected");
    h.session.shutdown();
  });

  it("rejects malformed and unsafe reconnect instructions", () => {
    const h = harness();
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-1");
    h.send(
      socket,
      message("bad-reconnect", "session_reconnect", {
        session: { reconnect_url: "http://evil.invalid" },
      }),
    );
    expect(h.session.status).toBe("connected");
    expect(h.sockets).toHaveLength(1);
    h.send(
      socket,
      message("credential-reconnect", "session_reconnect", {
        session: { reconnect_url: "wss://user:pass@evil.invalid/eventsub" },
      }),
    );
    h.send(
      socket,
      message("foreign-wss-reconnect", "session_reconnect", {
        session: { reconnect_url: "wss://evil.invalid/eventsub" },
      }),
    );
    expect(h.sockets).toHaveLength(1);
    h.send(socket, message("bad-json-payload", "session_reconnect", null));
    expect(h.sockets).toHaveLength(1);
    expect(() => h.send(socket, { metadata: { message_id: "bad" } })).not.toThrow();
    expect(() => socket.handlers.message("{")).not.toThrow();
    expect(() => socket.handlers.message("x".repeat(65 * 1024))).not.toThrow();
  });

  it("unexpected disconnect retries with bounded backoff then plans resubscription", () => {
    const h = harness();
    h.session.start();
    h.welcome(h.sockets[0]!, "welcome-1");
    const disconnectedSocket = h.sockets[0]!;
    disconnectedSocket.handlers.disconnect();
    h.send(
      disconnectedSocket,
      message("closed-socket-notification", "notification", { event: { text: "closed" } }),
    );
    expect(h.notifications).toHaveLength(0);
    expect(h.session.status).toBe("retry-wait");
    expect(h.timers.find((timer) => !timer.cancelled)?.delayMs).toBe(10);
    h.fireNextTimer();
    expect(h.sockets).toHaveLength(2);
    h.send(
      h.sockets[1]!,
      message("retry-early-notification", "notification", { event: { text: "before welcome" } }),
    );
    expect(h.notifications).toHaveLength(0);
    h.welcome(h.sockets[1]!, "welcome-2", "session-2");
    h.send(
      h.sockets[1]!,
      message("retry-valid-notification", "notification", { event: { text: "after welcome" } }),
    );
    expect(h.notifications).toHaveLength(1);
    expect(h.plans).toEqual([
      { sessionId: "session-1", plan: "initial" },
      { sessionId: "session-2", plan: "resubscribe" },
    ]);

    h.sockets[1]!.handlers.disconnect();
    h.fireNextTimer();
    h.sockets[2]!.handlers.disconnect();
    h.fireNextTimer();
    h.sockets[3]!.handlers.disconnect();
    expect(h.session.status).toBe("failed");
    expect(h.sockets).toHaveLength(4);
  });

  it("retries after missed keepalive, and valid keepalive refreshes the deadline", () => {
    let monotonicMs = 0;
    const h = harness({ monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-1");
    const keepaliveTimer = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    h.send(socket, message("keepalive", "session_keepalive"));
    expect(keepaliveTimer.cancelled).toBe(true);
    // A callback already queued by the host scheduler must not terminate the
    // session after the validated keepalive replaced its deadline.
    keepaliveTimer.callback();
    expect(h.session.status).toBe("connected");
    const activeTimeout = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 30_000;
    activeTimeout.callback();
    expect(h.session.status).toBe("connected");
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 32_500;
    grace.callback();
    expect(h.session.status).toBe("retry-wait");
  });

  it("answers sustained control pings without extending the keepalive deadline", () => {
    let connectingNow = 0;
    const connecting = harness({ monotonicNow: () => connectingNow });
    connecting.session.start();
    const connectionDeadline = connecting.timers.find((timer) => !timer.cancelled)!;
    for (let index = 0; index < 50; index += 1) connecting.sockets[0]!.handlers.ping();
    expect(connecting.sockets[0]?.pongs).toBe(50);
    expect(connectionDeadline.cancelled).toBe(false);
    connectingNow = 10_000;
    connectionDeadline.callback();
    expect(connecting.session.status).toBe("retry-wait");

    let monotonicMs = 0;
    const h = harness({ monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-1");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    for (let index = 0; index < 50; index += 1) socket.handlers.ping();
    expect(socket.pongs).toBe(50);
    expect(deadline.cancelled).toBe(false);
    expect(h.timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    monotonicMs = 30_000;
    deadline.callback();
    expect(h.session.status).toBe("connected");
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 32_500;
    grace.callback();
    expect(h.session.status).toBe("retry-wait");
  });

  it("does not extend deadlines for malformed frames or rejected notifications", () => {
    let monotonicMs = 0;
    const h = harness({ acceptNotification: () => false, monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-1");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    socket.handlers.message("{");
    socket.handlers.message("x".repeat(65 * 1024));
    h.send(socket, {
      ...message("invalid-timestamp", "session_keepalive"),
      metadata: {
        message_id: "invalid-timestamp",
        message_type: "session_keepalive",
        message_timestamp: "not-a-timestamp",
      },
    });
    h.send(socket, message("bad-keepalive", "session_keepalive", { unexpected: true }));
    h.send(socket, message("rejected-notification", "notification", { event: null }));
    expect(deadline.cancelled).toBe(false);
    expect(h.timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    expect(h.notifications).toHaveLength(0);
    monotonicMs = 30_000;
    deadline.callback();
    expect(h.session.status).toBe("connected");
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 32_500;
    grace.callback();
    expect(h.session.status).toBe("retry-wait");
  });

  it("resets the advertised keepalive deadline when a keepalive arrives just before expiry", () => {
    let monotonicMs = 0;
    const diagnostics = new EventSubDiagnostics();
    const h = harness({ diagnostics, monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-near-timeout");
    const initialDeadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    expect(initialDeadline.delayMs).toBe(30_000);

    monotonicMs = 29_999;
    h.send(socket, message("keepalive-near-timeout", "session_keepalive"));
    expect(initialDeadline.cancelled).toBe(true);
    expect(h.session.status).toBe("connected");
    expect(h.timers.filter((timer) => !timer.cancelled).at(-1)?.delayMs).toBe(30_000);
    expect(diagnostics.snapshot().counters.keepalives).toBe(1);
    h.session.shutdown();
  });

  it("accepts a keepalive at the advertised timeout boundary", () => {
    let monotonicMs = 0;
    const h = harness({ monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-boundary");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;

    monotonicMs = 30_000;
    h.send(socket, message("boundary-keepalive", "session_keepalive"));
    expect(deadline.cancelled).toBe(true);
    deadline.callback();
    expect(h.session.status).toBe("connected");
    expect(h.timers.filter((timer) => !timer.cancelled).at(-1)?.delayMs).toBe(30_000);
    h.session.shutdown();
  });

  it("accepts a keepalive received inside the bounded grace window", () => {
    let monotonicMs = 0;
    const h = harness({ monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-keepalive-grace");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 30_000;
    deadline.cancelled = true;
    deadline.callback();
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    expect(grace.delayMs).toBe(KEEPALIVE_TIMEOUT_GRACE_MS);

    monotonicMs = 30_100;
    h.send(socket, message("grace-keepalive", "session_keepalive"));
    expect(grace.cancelled).toBe(true);
    expect(h.session.status).toBe("connected");
    h.session.shutdown();
  });

  it("resets the health timer for a valid notification received during grace", () => {
    let monotonicMs = 0;
    const h = harness({ monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-notification-grace");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 30_000;
    deadline.cancelled = true;
    deadline.callback();
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;

    monotonicMs = 30_100;
    h.send(socket, message("grace-notification", "notification", { event: { ok: true } }));
    expect(grace.cancelled).toBe(true);
    expect(h.notifications).toHaveLength(1);
    expect(h.session.status).toBe("connected");
    expect(h.timers.filter((timer) => !timer.cancelled).at(-1)?.delayMs).toBe(30_000);
    h.session.shutdown();
  });

  it("declares keepalive loss only after the advertised timeout plus bounded grace", () => {
    let monotonicMs = 0;
    const diagnostics = new EventSubDiagnostics();
    const h = harness({ diagnostics, monotonicNow: () => monotonicMs });
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-expiration");
    const deadline = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    monotonicMs = 30_001;
    deadline.cancelled = true;
    deadline.callback();

    expect(h.session.status).toBe("connected");
    const grace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    expect(grace.delayMs).toBe(KEEPALIVE_TIMEOUT_GRACE_MS - 1);
    monotonicMs = 32_500;
    grace.cancelled = true;
    grace.callback();

    expect(h.session.status).toBe("retry-wait");
    expect(diagnostics.snapshot()).toMatchObject({
      disconnectReasons: { "keepalive-timeout": 1 },
      keepalive: { lastElapsedMs: 32_500, advertisedTimeoutMs: 30_000 },
      lastDisconnect: {
        reason: "keepalive-timeout",
        elapsedMs: 32_500,
        timeoutMs: 30_000,
      },
    });
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("welcome-expiration");
    h.session.shutdown();
  });

  it.each([250, 251, 2_000, 2_499])(
    "accepts validated traffic delayed %i ms, and fences a queued stale watchdog",
    (jitterMs) => {
      let now = 0;
      const h = harness({ monotonicNow: () => now });
      h.session.start();
      const socket = h.sockets[0]!;
      h.welcome(socket, "welcome-jitter");
      now = 30_000;
      h.fireNextTimer();
      const oldGrace = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
      now += jitterMs;
      oldGrace.callback(); // Early/delayed scheduling must recheck elapsed time.
      expect(h.session.status).toBe("connected");
      h.send(socket, message("late-valid-keepalive", "session_keepalive"));
      now = 32_500;
      oldGrace.callback(); // A callback already queued before refresh is inert.
      expect(h.session.status).toBe("connected");
      h.session.shutdown();
    },
  );

  it.each([2_500, 2_501, 10_000])(
    "fails closed for true silence with %i ms overdue, even with control pings",
    (jitterMs) => {
      let now = 0;
      const h = harness({ monotonicNow: () => now });
      h.session.start();
      const socket = h.sockets[0]!;
      h.welcome(socket, "welcome-silence");
      now = 30_000 + jitterMs;
      socket.handlers.ping();
      h.fireNextTimer();
      expect(h.session.status).toBe("retry-wait");
      expect(socket.closed).toBe(true);
      h.session.shutdown();
    },
  );

  it("keeps a smaller welcome timeout authoritative and bounds the same allowance", () => {
    let now = 0;
    const h = harness({ monotonicNow: () => now });
    h.session.start();
    h.send(
      h.sockets[0]!,
      message("welcome-short", "session_welcome", {
        session: { id: "short-session", keepalive_timeout_seconds: 10 },
      }),
    );
    now = 10_000;
    h.fireNextTimer();
    expect(h.session.status).toBe("connected");
    expect(h.timers.filter((timer) => !timer.cancelled).at(-1)?.delayMs).toBe(2_500);
    now = 12_500;
    h.fireNextTimer();
    expect(h.session.status).toBe("retry-wait");
    h.session.shutdown();
  });

  it("does not establish a handshake from a malformed welcome", () => {
    const h = harness();
    h.session.start();
    const socket = h.sockets[0]!;
    const deadline = h.timers.find((timer) => !timer.cancelled)!;
    h.send(socket, {
      ...message("malformed-welcome", "session_welcome", {
        session: { id: "not-established", keepalive_timeout_seconds: 30 },
      }),
      metadata: {
        message_id: "malformed-welcome",
        message_type: "session_welcome",
        message_timestamp: "bad-time",
      },
    });
    expect(h.session.status).toBe("connecting");
    expect(deadline.cancelled).toBe(false);
    expect(h.plans).toHaveLength(0);
  });

  it("bounds a connection attempt that never receives a welcome", () => {
    let monotonicMs = 0;
    const h = harness({ maxRetries: 1, monotonicNow: () => monotonicMs });
    h.session.start();
    expect(h.timers.find((timer) => !timer.cancelled)?.delayMs).toBe(10_000);
    monotonicMs = 10_000;
    h.fireNextTimer();
    expect(h.session.status).toBe("retry-wait");
    h.fireNextTimer();
    expect(h.sockets).toHaveLength(2);
    monotonicMs = 20_000;
    h.fireNextTimer();
    expect(h.session.status).toBe("failed");
  });

  it("revocation closes transports and shutdown clears timers without reconnect", () => {
    const revoked = harness();
    revoked.session.start();
    const socket = revoked.sockets[0]!;
    revoked.welcome(socket, "welcome-1");
    revoked.send(
      socket,
      message("revoke-1", "revocation", { subscription: { status: "authorization_revoked" } }),
    );
    expect(revoked.session.status).toBe("revoked");
    expect(socket.closed).toBe(true);
    socket.handlers.message(JSON.stringify(message("after-revocation", "notification")));
    expect(revoked.notifications).toHaveLength(0);

    const stopped = harness();
    stopped.session.start();
    const stoppedSocket = stopped.sockets[0]!;
    stopped.welcome(stoppedSocket, "welcome-1");
    stopped.session.shutdown();
    expect(stopped.session.status).toBe("stopped");
    expect(stoppedSocket.closed).toBe(true);
    expect(stopped.timers.every((timer) => timer.cancelled)).toBe(true);
    stoppedSocket.handlers.message(JSON.stringify(message("after-shutdown", "notification")));
    expect(stopped.notifications).toHaveLength(0);
    stoppedSocket.handlers.disconnect();
    expect(stopped.sockets).toHaveLength(1);
  });

  it("uses only the supplied fake transport and never opens a live network connection", () => {
    const h = harness();
    h.session.start();
    expect(h.sockets.map((socket) => socket.url)).toEqual(["wss://fixtures.invalid/eventsub"]);
    expect(h.session.status).toBe("connecting");
    h.session.shutdown();
    expect(h.sockets[0]?.closed).toBe(true);
  });
});
