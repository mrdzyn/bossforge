import { describe, expect, it } from "vitest";
import {
  AppEventEnvelopeSchema,
  BossSchema,
  NormalizedChatEventSchema,
  createEventEnvelope,
  parseVoteCommand,
} from "../src/index.js";

const viewer = { id: "mock-ember", displayName: "EmberFan" };
const timestamp = "2026-10-26T12:00:00.000Z";

describe("shared contracts", () => {
  it("accepts a valid normalized chat event", () => {
    const event = {
      kind: "chat.message",
      provider: "mock",
      message: {
        id: "mock-message-1",
        viewer,
        text: "!vote element fire",
        occurredAt: timestamp,
        command: { category: "element", choice: "fire" },
      },
    };
    expect(NormalizedChatEventSchema.parse(event)).toEqual(event);
  });

  it("rejects malformed chat payloads", () => {
    expect(
      NormalizedChatEventSchema.safeParse({
        kind: "chat.message",
        provider: "mock",
        message: { id: "", viewer, text: "x".repeat(501), occurredAt: "yesterday" },
      }).success,
    ).toBe(false);
  });

  it("round-trips a versioned event envelope through JSON", () => {
    const envelope = createEventEnvelope(
      {
        kind: "viewer.connected",
        provider: "mock",
        viewer,
        occurredAt: timestamp,
      },
      "a29eaa04-d2a0-4f4d-bf84-152fe4c7e9cb",
      timestamp,
    );
    expect(AppEventEnvelopeSchema.parse(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  });

  it("rejects an envelope whose type does not match its payload", () => {
    expect(
      AppEventEnvelopeSchema.safeParse({
        type: "chat.event",
        schemaVersion: 1,
        id: "a29eaa04-d2a0-4f4d-bf84-152fe4c7e9cb",
        timestamp,
        payload: { kind: "connection.status", source: "mock", status: "connected" },
      }).success,
    ).toBe(false);
  });

  it("parses only supported vote commands", () => {
    expect(parseVoteCommand("!vote element fire")).toEqual({ category: "element", choice: "fire" });
    expect(parseVoteCommand("!vote admin restart")).toBeUndefined();
  });

  it("rejects out-of-range boss statistics", () => {
    expect(
      BossSchema.safeParse({
        id: "boss-1",
        name: "Ash Warden",
        attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
        stats: { health: 0, damage: 20, attackIntervalMs: 1000 },
      }).success,
    ).toBe(false);
  });
});
