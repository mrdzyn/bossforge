import { describe, expect, it } from "vitest";
import { MockChatAdapter } from "../src/adapters/mock-chat-adapter.js";

describe("MockChatAdapter", () => {
  it("emits the same validated event sequence for the same clock", async () => {
    const now = () => new Date("2026-10-26T12:00:00.000Z");
    const first = new MockChatAdapter(now);
    const second = new MockChatAdapter(now);
    await Promise.all([first.connect(), second.connect()]);

    const firstEvents = Array.from({ length: 4 }, () => first.nextEvent());
    const secondEvents = Array.from({ length: 4 }, () => second.nextEvent());
    expect(firstEvents).toEqual(secondEvents);
    expect(firstEvents.map((event) => event?.kind)).toEqual([
      "viewer.connected",
      "chat.message",
      "chat.message",
      "viewer.disconnected",
    ]);
    expect(firstEvents[2]).toMatchObject({
      kind: "chat.message",
      message: { command: { category: "element", choice: "fire" } },
    });
  });

  it("tracks its lifecycle and stops producing events after disconnect", async () => {
    const adapter = new MockChatAdapter();
    expect(adapter.status).toBe("disconnected");
    expect(adapter.nextEvent()).toBeUndefined();
    await adapter.connect();
    expect(adapter.status).toBe("connected");
    expect(adapter.nextEvent()).toBeDefined();
    await adapter.disconnect();
    expect(adapter.status).toBe("disconnected");
    expect(adapter.nextEvent()).toBeUndefined();
  });
});
