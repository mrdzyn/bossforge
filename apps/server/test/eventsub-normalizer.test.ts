import { describe, expect, it } from "vitest";
import { ForgeSession } from "../src/forge/forge-session.js";
import { EventSubChatNormalizer } from "../src/twitch/eventsub-normalizer.js";

const NOW = "2026-10-26T12:00:10.000Z";
const CHANNEL = "123456";

function fixture(overrides: Record<string, unknown> = {}) {
  const event = {
    broadcaster_user_id: CHANNEL,
    chatter_user_id: "987654",
    chatter_user_login: "viewer_login",
    chatter_user_name: "ViewerName",
    message_id: "message-1",
    message: { text: "!vote body drake", fragments: [{ type: "text", text: "!vote body drake" }] },
    ...((overrides.event as object | undefined) ?? {}),
  };
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
            type: "channel.chat.message",
            version: "1",
            condition: { broadcaster_user_id: CHANNEL },
            ...((overrides.subscription as object | undefined) ?? {}),
          },
          event,
        },
  };
}

function normalizer(options: { now?: string; maxMessageBytes?: number } = {}) {
  return new EventSubChatNormalizer({
    broadcasterUserId: CHANNEL,
    now: () => new Date(options.now ?? NOW),
    ...(options.maxMessageBytes ? { maxMessageBytes: options.maxMessageBytes } : {}),
  });
}

describe("offline EventSub chat normalizer", () => {
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
