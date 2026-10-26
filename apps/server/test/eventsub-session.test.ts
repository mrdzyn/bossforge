import { describe, expect, it } from "vitest";
import {
  EventSubSession,
  type EventSubScheduler,
  type EventSubTransport,
  type EventSubTransportHandlers,
  type SubscriptionPlan,
} from "../src/twitch/eventsub-session.js";

type FakeSocket = {
  url: string;
  handlers: EventSubTransportHandlers;
  closed: boolean;
  pongs: number;
};

function harness(options: { maxRetries?: number } = {}) {
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
    onNotification: (message) => notifications.push(message),
    onSubscriptionPlan: (sessionId, plan) => plans.push({ sessionId, plan }),
    scheduler,
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
      metadata: { message_id: id, message_type: "session_welcome" },
      payload: { session: { id: sessionId, keepalive_timeout_seconds: 30 } },
    });
  return { session, timers, sockets, notifications, plans, fireNextTimer, send, welcome };
}

const message = (id: string, type: string, payload: unknown = {}) => ({
  metadata: { message_id: id, message_type: type },
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
    h.welcome(socket, "welcome-1");
    expect(h.session.status).toBe("connected");
    expect(h.plans).toEqual([{ sessionId: "session-1", plan: "initial" }]);

    const notification = message("notification-1", "notification", { event: { text: "hello" } });
    h.send(socket, notification);
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
    const reconnectUrl = "wss://redirect.example/eventsub?session_id=preserve-me";
    h.send(
      oldSocket,
      message("reconnect-1", "session_reconnect", { session: { reconnect_url: reconnectUrl } }),
    );
    expect(h.session.status).toBe("reconnecting");
    expect(h.sockets[1]?.url).toBe(reconnectUrl);
    expect(oldSocket.closed).toBe(false);
    h.welcome(h.sockets[1]!, "welcome-new", "new-session");
    expect(oldSocket.closed).toBe(true);
    expect(h.session.status).toBe("connected");
    expect(h.plans).toHaveLength(1);
    oldSocket.handlers.message(
      JSON.stringify(message("late-old-socket", "notification", { event: { text: "stale" } })),
    );
    expect(h.notifications).toHaveLength(0);
  });

  it("does not schedule a competing retry if the old socket drops during reconnect", () => {
    const h = harness();
    h.session.start();
    const oldSocket = h.sockets[0]!;
    h.welcome(oldSocket, "welcome-old");
    h.send(
      oldSocket,
      message("reconnect-1", "session_reconnect", {
        session: { reconnect_url: "wss://redirect.example/eventsub" },
      }),
    );
    oldSocket.handlers.disconnect();
    expect(h.session.status).toBe("reconnecting");
    expect(h.timers.filter((timer) => !timer.cancelled)).toHaveLength(1);
    h.welcome(h.sockets[1]!, "welcome-new", "new-session");
    expect(h.session.status).toBe("connected");
    expect(h.plans).toHaveLength(1);
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
    h.sockets[0]!.handlers.disconnect();
    expect(h.session.status).toBe("retry-wait");
    expect(h.timers.find((timer) => !timer.cancelled)?.delayMs).toBe(10);
    h.fireNextTimer();
    expect(h.sockets).toHaveLength(2);
    h.welcome(h.sockets[1]!, "welcome-2", "session-2");
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
    const h = harness();
    h.session.start();
    const socket = h.sockets[0]!;
    h.welcome(socket, "welcome-1");
    const keepaliveTimer = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    h.send(socket, message("keepalive", "session_keepalive"));
    expect(keepaliveTimer.cancelled).toBe(true);
    const activeTimeout = h.timers.filter((timer) => !timer.cancelled).at(-1)!;
    activeTimeout.callback();
    expect(h.session.status).toBe("retry-wait");
  });

  it("bounds a connection attempt that never receives a welcome", () => {
    const h = harness({ maxRetries: 1 });
    h.session.start();
    expect(h.timers.find((timer) => !timer.cancelled)?.delayMs).toBe(10_000);
    h.fireNextTimer();
    expect(h.session.status).toBe("retry-wait");
    h.fireNextTimer();
    expect(h.sockets).toHaveLength(2);
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

    const stopped = harness();
    stopped.session.start();
    const stoppedSocket = stopped.sockets[0]!;
    stopped.welcome(stoppedSocket, "welcome-1");
    stopped.session.shutdown();
    expect(stopped.session.status).toBe("stopped");
    expect(stoppedSocket.closed).toBe(true);
    expect(stopped.timers.every((timer) => timer.cancelled)).toBe(true);
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
