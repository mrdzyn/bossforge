import { describe, expect, it } from "vitest";
import { ForgeSession } from "../src/forge/forge-session.js";
import { EventSubChatNormalizer } from "../src/twitch/eventsub-normalizer.js";

const NOW = "2026-10-26T12:00:10.000Z";
const CHANNEL = "123456";
const CHAT_READER = "111222";

function fixture(overrides: Record<string, unknown> = {}) {
  const event = {
    broadcaster_user_id: CHANNEL,
    broadcaster_user_login: "channel_login",
    broadcaster_user_name: "ChannelName",
    chatter_user_id: "987654",
    chatter_user_login: "viewer_login",
    chatter_user_name: "ViewerName",
    message_id: "message-1",
    message: { text: "!vote body drake", fragments: [{ type: "text", text: "!vote body drake" }] },
    color: "#9147FF",
    badges: [{ set_id: "subscriber", id: "1", info: "12" }],
    message_type: "text",
    ...((overrides.event as object | undefined) ?? {}),
  };
  const subscriptionOverrides =
    (overrides.subscription as Record<string, unknown> | undefined) ?? {};
  const conditionOverrides =
    (subscriptionOverrides.condition as Record<string, unknown> | undefined) ?? {};
  return {
    metadata: {
      message_id: "eventsub-1",
      message_type: "notification",
      message_timestamp: "2026-10-26T12:00:09.123456789Z",
      subscription_type: "channel.chat.message",
      subscription_version: "1",
      ...((overrides.metadata as object | undefined) ?? {}),
    },
    payload: Object.hasOwn(overrides, "payload")
      ? overrides.payload
      : {
          subscription: {
            id: "offline-subscription-1",
            status: "enabled",
            type: "channel.chat.message",
            version: "1",
            cost: 1,
            ...subscriptionOverrides,
            condition: {
              broadcaster_user_id: CHANNEL,
              user_id: CHAT_READER,
              ...conditionOverrides,
            },
            transport: { method: "websocket", session_id: "offline-session-1" },
          },
          event,
        },
  };
}

function normalizer(options: { now?: string; maxMessageBytes?: number } = {}) {
  return new EventSubChatNormalizer({
    broadcasterUserId: CHANNEL,
    authorizedChatReaderUserId: CHAT_READER,
    now: () => new Date(options.now ?? NOW),
    ...(options.maxMessageBytes ? { maxMessageBytes: options.maxMessageBytes } : {}),
  });
}

describe("offline EventSub chat normalizer", () => {
  it("requires a valid configured chat-reader identity", () => {
    expect(
      () =>
        new EventSubChatNormalizer({
          broadcasterUserId: CHANNEL,
          authorizedChatReaderUserId: "not-a-user-id",
        }),
    ).toThrow("authorized Twitch chat reader user ID");
  });

  it("normalizes official-shaped v1 chat using stable IDs and Twitch timestamps", () => {
    const result = normalizer().normalize(fixture());
    expect(result).toMatchObject({
      ok: true,
      event: {
        kind: "chat.message",
        provider: "twitch",
        message: {
          id: "message-1",
          viewer: { id: "987654", displayName: "ViewerName" },
          text: "!vote body drake",
          occurredAt: "2026-10-26T12:00:09.123Z",
          command: { category: "body", choice: "drake" },
        },
      },
    });
  });

  it.each([
    ["malformed payload", { payload: null }, "malformed"],
    [
      "unsupported subscription",
      { metadata: { subscription_type: "channel.follow" } },
      "malformed",
    ],
    ["wrong channel", { event: { broadcaster_user_id: "654321" } }, "wrong-channel"],
    [
      "wrong condition",
      { subscription: { condition: { broadcaster_user_id: "654321" } } },
      "wrong-channel",
    ],
    ["missing chat reader", { subscription: { condition: { user_id: undefined } } }, "malformed"],
    [
      "malformed chat reader",
      { subscription: { condition: { user_id: "reader name" } } },
      "malformed",
    ],
    [
      "unauthorized chat reader",
      { subscription: { condition: { user_id: "999888" } } },
      "unauthorized-chat-reader",
    ],
    ["unsupported message type", { metadata: { message_type: "session_welcome" } }, "unsupported"],
    ["invalid stable user ID", { event: { chatter_user_id: "viewer name" } }, "malformed"],
    ["invalid timestamp", { metadata: { message_timestamp: "not-a-date" } }, "malformed"],
    ["oversized chat", { event: { message: { text: "x".repeat(501) } } }, "malformed"],
  ] as const)("rejects %s", (_label, overrides, reason) => {
    expect(normalizer().normalize(fixture(overrides))).toEqual({ ok: false, reason });
  });

  it("rejects oversized serialized packets before parsing", () => {
    expect(normalizer({ maxMessageBytes: 120 }).normalize(fixture())).toEqual({
      ok: false,
      reason: "oversized",
    });
  });

  it("rejects duplicate event IDs and out-of-order timestamps", () => {
    const parser = normalizer();
    expect(parser.normalize(fixture()).ok).toBe(true);
    expect(parser.normalize(fixture())).toEqual({ ok: false, reason: "duplicate" });
    const older = fixture({
      metadata: { message_id: "eventsub-older", message_timestamp: "2026-10-26T12:00:08.000Z" },
      event: { message_id: "message-older" },
    });
    expect(parser.normalize(older)).toEqual({ ok: false, reason: "out-of-order" });
  });

  it("rejects stale and future-dated messages", () => {
    const parser = normalizer();
    expect(
      parser.normalize(fixture({ metadata: { message_timestamp: "2026-10-26T11:50:00.000Z" } })),
    ).toEqual({ ok: false, reason: "stale-or-future" });
    expect(
      parser.normalize(fixture({ metadata: { message_timestamp: "2026-10-26T12:00:11.000Z" } })),
    ).toEqual({ ok: false, reason: "stale-or-future" });
  });

  it("never lets normalized Twitch fixtures mutate the mock-only ForgeSession", () => {
    const normalized = normalizer().normalize(fixture());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const session = new ForgeSession(() => new Date(NOW));
    session.start(15);
    const before = session.getState();
    expect(normalized.event.provider).toBe("twitch");
    expect(session.handleEvent(normalized.event)).toBe(false);
    expect(session.getState()).toEqual(before);
    expect(session.getState()).toMatchObject({ simulated: true, connectedToTwitch: false });
  });
});
