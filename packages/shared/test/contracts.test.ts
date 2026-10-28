import { describe, expect, it } from "vitest";
import {
  BossSchema,
  DashboardEventEnvelopeSchema,
  OverlayEventEnvelopeSchema,
  parseVoteCommand,
} from "../src/index.js";

const timestamp = "2026-10-26T12:00:00.000Z";
const state = {
  serverInstanceId: "server-test",
  serverStartedAt: timestamp,
  revision: 0,
  cycleId: null,
  status: "idle",
  mode: "mock",
  simulated: true,
  connectedToTwitch: false,
  durationSeconds: 15,
  startedAt: null,
  activeCategory: null,
  progress: 0,
  categories: ["body", "element", "special", "weakness"].map((category) => ({
    category,
    status: "pending",
    options: [
      { choice: "a", count: 0, percentage: 0 },
      { choice: "b", count: 0, percentage: 0 },
    ],
    totalVotes: 0,
    openedAt: null,
    closesAt: null,
    winner: null,
    noVoteFallback: false,
  })),
  boss: null,
};

describe("shared contracts", () => {
  it("strictly rejects raw chat, unknown envelope fields, and nested identity injection", () => {
    const base = {
      type: "forge.state",
      schemaVersion: 1,
      id: "a29eaa04-d2a0-4f4d-bf84-152fe4c7e9cb",
      timestamp,
      payload: { kind: "forge.state", source: "mock", state },
    };
    expect(
      DashboardEventEnvelopeSchema.safeParse({
        ...base,
        type: "chat.event",
        payload: { kind: "chat.event", message: "SENTINEL_PRIVATE_CHAT" },
      }).success,
    ).toBe(false);
    expect(
      DashboardEventEnvelopeSchema.safeParse({ ...base, viewerId: "SENTINEL_ID" }).success,
    ).toBe(false);
    expect(
      DashboardEventEnvelopeSchema.safeParse({
        ...base,
        payload: {
          ...base.payload,
          state: {
            ...state,
            categories: state.categories.map((item, index) =>
              index
                ? item
                : {
                    ...item,
                    options: [
                      { ...item.options[0], viewer: { id: "SENTINEL_ID" } },
                      item.options[1],
                    ],
                  },
            ),
          },
        },
      }).success,
    ).toBe(false);
    expect(
      OverlayEventEnvelopeSchema.safeParse({
        ...base,
        payload: { ...base.payload, state: { ...state, chat: "SENTINEL_CHAT" } },
      }).success,
    ).toBe(false);
    expect(
      OverlayEventEnvelopeSchema.safeParse({
        type: "dashboard.activity",
        schemaVersion: 1,
        id: "a29eaa04-d2a0-4f4d-bf84-152fe4c7e9cb",
        timestamp,
        payload: {
          serverInstanceId: "server-test",
          cycleId: null,
          accepted: 1,
          rejected: 0,
          reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
        },
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
