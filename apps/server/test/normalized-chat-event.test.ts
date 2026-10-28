import { describe, expect, it } from "vitest";
import { NormalizedChatEventSchema } from "../src/events/normalized-chat-event.js";

const timestamp = "2026-10-26T12:00:00.000Z";

describe("private normalized chat event contract", () => {
  it("validates normalized mock or Twitch messages for internal server processing", () => {
    const event = {
      kind: "chat.message",
      provider: "twitch",
      message: {
        id: "internal-message-1",
        viewer: { id: "123456", displayName: "PrivateViewer" },
        text: "!vote element fire",
        occurredAt: timestamp,
        command: { category: "element", choice: "fire" },
      },
    };
    expect(NormalizedChatEventSchema.parse(event)).toEqual(event);
  });

  it("rejects malformed internal normalized chat before ForgeSession processing", () => {
    expect(
      NormalizedChatEventSchema.safeParse({
        kind: "chat.message",
        provider: "mock",
        message: {
          id: "",
          viewer: { id: "viewer", displayName: "x".repeat(51) },
          text: "x".repeat(501),
          occurredAt: "yesterday",
        },
      }).success,
    ).toBe(false);
  });
});
