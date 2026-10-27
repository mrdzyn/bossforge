import { EventEmitter } from "node:events";
import type WebSocket from "ws";
import { describe, expect, it, vi } from "vitest";
import { LiveEventSub } from "../src/twitch/live-eventsub.js";

class FakeSocket extends EventEmitter {
  sendFrame(frame: unknown): void {
    this.emit("message", Buffer.from(JSON.stringify(frame)));
  }
}

const frame = (id: string, type: string, payload: unknown) => ({
  metadata: {
    message_id: id,
    message_type: type,
    message_timestamp: new Date().toISOString(),
    ...(type === "notification"
      ? { subscription_type: "channel.chat.message", subscription_version: "1" }
      : {}),
  },
  payload,
});

describe("live EventSub adapter with fake Twitch transports", () => {
  it("subscribes after welcome and forwards only validated Twitch notifications", async () => {
    const socket = new FakeSocket();
    const events: unknown[] = [];
    const status = vi.fn();
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({
          data: [
            {
              type: "channel.chat.message",
              version: "1",
              status: "enabled",
              condition: { broadcaster_user_id: "12345", user_id: "12345" },
              transport: { session_id: "eventsub-session" },
            },
          ],
        }),
        { status: 202 },
      );
    }) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => socket as unknown as WebSocket,
      onStatus: status,
      onChat: (event) => events.push(event),
    });
    live.start();

    const notification = frame("notification-frame", "notification", {
      subscription: {
        type: "channel.chat.message",
        version: "1",
        condition: { broadcaster_user_id: "12345", user_id: "12345" },
      },
      event: {
        broadcaster_user_id: "12345",
        chatter_user_id: "777",
        chatter_user_login: "viewer",
        chatter_user_name: "Viewer",
        message_id: "chat-message-1",
        message: { text: "!vote body drake" },
      },
    });
    socket.sendFrame(notification);
    expect(events).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();

    socket.sendFrame(
      frame("welcome-frame", "session_welcome", {
        session: { id: "eventsub-session", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      type: "channel.chat.message",
      version: "1",
      condition: { broadcaster_user_id: "12345", user_id: "12345" },
      transport: { method: "websocket", session_id: "eventsub-session" },
    });
    expect((fetcher.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization).toBe(
      "Bearer access-token",
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    socket.sendFrame(notification);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "chat.message",
      provider: "twitch",
      message: { viewer: { id: "777" }, text: "!vote body drake" },
    });
    live.shutdown();
  });

  it("does not report live when subscription activation fails", async () => {
    const socket = new FakeSocket();
    const status = vi.fn();
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: (async () => new Response("{}", { status: 403 })) as typeof fetch,
      createSocket: () => socket as unknown as WebSocket,
      onStatus: status,
      onChat: () => undefined,
    });
    live.start();
    socket.sendFrame(
      frame("welcome-frame", "session_welcome", {
        session: { id: "eventsub-session", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(status).toHaveBeenCalledWith("failed", false));
    expect(live.connected).toBe(false);
    live.shutdown();
  });

  it("refreshes once and retries the Helix subscription after an expired token response", async () => {
    const socket = new FakeSocket();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockImplementationOnce(async (_input: string | URL | Request, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer refreshed-token",
        );
        return new Response(
          JSON.stringify({
            data: [
              {
                type: "channel.chat.message",
                version: "1",
                status: "enabled",
                condition: { broadcaster_user_id: "12345", user_id: "12345" },
                transport: { session_id: "eventsub-session" },
              },
            ],
          }),
          { status: 202 },
        );
      }) as unknown as typeof fetch;
    const refreshAccessToken = vi.fn(async () => "refreshed-token");
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "expired-token",
      refreshAccessToken,
      fetch: fetcher,
      createSocket: () => socket as unknown as WebSocket,
      onStatus: () => undefined,
      onChat: () => undefined,
    });
    live.start();
    socket.sendFrame(
      frame("welcome-refresh", "session_welcome", {
        session: { id: "eventsub-session", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
    live.shutdown();
  });

  it("creates a new Helix subscription after an unexpected socket loss", async () => {
    const sockets: FakeSocket[] = [];
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { transport: { session_id: string } };
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
    }) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onStatus: () => undefined,
      onChat: () => undefined,
    });
    live.start();
    sockets[0]!.sendFrame(
      frame("welcome-first", "session_welcome", {
        session: { id: "eventsub-session", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    sockets[0]!.emit("close");
    await vi.waitFor(() => expect(sockets).toHaveLength(2), { timeout: 2_000 });
    sockets[1]!.sendFrame(
      frame("welcome-second", "session_welcome", {
        session: { id: "eventsub-session-2", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    live.shutdown();
  });

  it("ignores close and error events from the retired socket after a welcomed reconnect", async () => {
    const sockets: FakeSocket[] = [];
    const events: unknown[] = [];
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { transport: { session_id: string } };
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
    }) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onStatus: () => undefined,
      onChat: (event) => events.push(event),
    });
    live.start();
    sockets[0]!.sendFrame(
      frame("handoff-first", "session_welcome", {
        session: { id: "handoff-a", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    sockets[0]!.sendFrame(
      frame("handoff-reconnect", "session_reconnect", {
        session: { reconnect_url: "wss://eventsub.wss.twitch.tv/ws?handoff=1" },
      }),
    );
    expect(sockets).toHaveLength(2);
    sockets[1]!.sendFrame(
      frame("handoff-second", "session_welcome", {
        session: { id: "handoff-b", keepalive_timeout_seconds: 30 },
      }),
    );
    sockets[0]!.emit("close");
    sockets[0]!.emit("error", new Error("retired socket"));
    expect(live.connected).toBe(true);
    sockets[1]!.sendFrame(
      frame("handoff-chat", "notification", {
        subscription: {
          type: "channel.chat.message",
          version: "1",
          condition: { broadcaster_user_id: "12345", user_id: "12345" },
        },
        event: {
          broadcaster_user_id: "12345",
          chatter_user_id: "777",
          chatter_user_login: "viewer",
          chatter_user_name: "Viewer",
          message_id: "handoff-chat-message",
          message: { text: "!vote body drake" },
        },
      }),
    );
    expect(events).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledOnce();
    live.shutdown();
  });

  it("discards a delayed Helix success from an earlier welcomed session", async () => {
    const sockets: FakeSocket[] = [];
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFirst = resolve)))
      .mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body)) as {
          transport: { session_id: string };
        };
        if (requestBody.transport.session_id === "delayed-b")
          return new Promise<Response>((resolve) => (resolveSecond = resolve));
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
      }) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onStatus: () => undefined,
      onChat: () => undefined,
    });
    live.start();
    sockets[0]!.sendFrame(
      frame("delayed-a-welcome", "session_welcome", {
        session: { id: "delayed-a", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    sockets[0]!.emit("close");
    await vi.waitFor(() => expect(sockets).toHaveLength(2), { timeout: 2_000 });
    sockets[1]!.sendFrame(
      frame("delayed-b-welcome", "session_welcome", {
        session: { id: "delayed-b", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    resolveFirst(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "channel.chat.message",
              version: "1",
              status: "enabled",
              condition: { broadcaster_user_id: "12345", user_id: "12345" },
              transport: { session_id: "delayed-a" },
            },
          ],
        }),
        { status: 202 },
      ),
    );
    await Promise.resolve();
    expect(live.connected).toBe(false);
    resolveSecond(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "channel.chat.message",
              version: "1",
              status: "enabled",
              condition: { broadcaster_user_id: "12345", user_id: "12345" },
              transport: { session_id: "delayed-b" },
            },
          ],
        }),
        { status: 202 },
      ),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    live.shutdown();
  });

  it("discards a delayed 409 verification from an earlier welcomed session", async () => {
    const sockets: FakeSocket[] = [];
    let resolveOldVerification!: (response: Response) => void;
    let resolveCurrentPost!: (response: Response) => void;
    const subscription = (sessionId: string) => ({
      type: "channel.chat.message",
      version: "1",
      status: "enabled",
      condition: { broadcaster_user_id: "12345", user_id: "12345" },
      transport: { session_id: sessionId },
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveOldVerification = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveCurrentPost = resolve)),
      ) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onStatus: () => undefined,
      onChat: () => undefined,
    });
    live.start();
    sockets[0]!.sendFrame(
      frame("delayed-409-a", "session_welcome", {
        session: { id: "delayed-409-a", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    sockets[0]!.emit("close");
    await vi.waitFor(() => expect(sockets).toHaveLength(2), { timeout: 2_000 });
    sockets[1]!.sendFrame(
      frame("delayed-409-b", "session_welcome", {
        session: { id: "delayed-409-b", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    resolveOldVerification(
      new Response(JSON.stringify({ data: [subscription("delayed-409-a")] }), { status: 200 }),
    );
    await Promise.resolve();
    expect(live.connected).toBe(false);
    resolveCurrentPost(
      new Response(JSON.stringify({ data: [subscription("delayed-409-b")] }), { status: 202 }),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    live.shutdown();
  });

  it("does not let a stale Helix error fail the current welcomed session", async () => {
    const sockets: FakeSocket[] = [];
    let rejectOldRequest!: (error: Error) => void;
    let resolveCurrentRequest!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectOldRequest = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveCurrentRequest = resolve;
          }),
      ) as typeof fetch;
    const live = new LiveEventSub({
      clientId: "client-id",
      identity: { id: "12345", login: "owner", displayName: "Owner" },
      getAccessToken: async () => "access-token",
      fetch: fetcher,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      onStatus: () => undefined,
      onChat: () => undefined,
    });
    live.start();
    sockets[0]!.sendFrame(
      frame("stale-error-a", "session_welcome", {
        session: { id: "stale-error-a", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    sockets[0]!.emit("close");
    await vi.waitFor(() => expect(sockets).toHaveLength(2), { timeout: 2_000 });
    sockets[1]!.sendFrame(
      frame("stale-error-b", "session_welcome", {
        session: { id: "stale-error-b", keepalive_timeout_seconds: 30 },
      }),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    rejectOldRequest(new Error("stale session failed"));
    await Promise.resolve();
    expect(live.status).toBe("subscribing");
    expect(live.connected).toBe(false);
    resolveCurrentRequest(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "channel.chat.message",
              version: "1",
              status: "enabled",
              condition: { broadcaster_user_id: "12345", user_id: "12345" },
              transport: { session_id: "stale-error-b" },
            },
          ],
        }),
        { status: 202 },
      ),
    );
    await vi.waitFor(() => expect(live.connected).toBe(true));
    live.shutdown();
  });
});
