import { describe, expect, it } from "vitest";
import { ForgeSession, type ForgeScheduler } from "../src/forge/forge-session.js";
import { assembleBoss } from "../src/forge/boss-assembly.js";

function setup() {
  let millis = Date.parse("2026-10-26T12:00:00.000Z");
  const callbacks: Array<() => void> = [];
  const scheduler: ForgeScheduler = {
    schedule(callback) {
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index >= 0) callbacks.splice(index, 1);
      };
    },
  };
  const session = new ForgeSession(() => new Date(millis), scheduler);
  const tick = () => {
    millis += 5000;
    callbacks.shift()?.();
  };
  const vote = (
    id: string,
    viewerId: string,
    text: string,
    provider: "mock" | "twitch" = "mock",
    occurredAt?: string,
  ) =>
    session.handleEvent({
      kind: "chat.message",
      provider,
      message: {
        id,
        viewer: { id: viewerId, displayName: "Same display name" },
        text,
        occurredAt: occurredAt ?? new Date(millis).toISOString(),
      },
    });
  return { session, tick, vote, pendingTimers: () => callbacks.length };
}

describe("ForgeSession", () => {
  it("supports one mutable vote per viewer and deterministic tie ordering", () => {
    const { session, vote, tick } = setup();
    session.start(5);
    const initial = session.getState();
    expect(initial.progress).toBe(1);
    expect(initial.categories[0]?.closesAt).toBe("2026-10-26T12:00:05.000Z");
    expect(vote("1", "viewer-a", "!vote body drake")).toBe(true);
    expect(vote("2", "viewer-a", "!vote body golem")).toBe(true);
    expect(vote("3", "viewer-b", "!vote body drake")).toBe(true);
    expect(session.getState().categories[0]?.totalVotes).toBe(2);
    tick();
    expect(session.getState().categories[0]).toMatchObject({
      winner: "golem",
      noVoteFallback: false,
    });
    expect(session.getState().activeCategory).toBe("element");
    expect(session.getState().progress).toBe(2);
  });

  it("rejects duplicate, invalid, wrong-category, stale, late and non-mock votes", () => {
    const { session, vote, tick } = setup();
    session.start(5);
    expect(vote("v1", "a", "!vote body golem", "twitch")).toBe(false);
    expect(vote("v2", "a", "!vote element fire")).toBe(false);
    expect(vote("v3", "a", "!vote body dragon")).toBe(false);
    expect(
      session.handleEvent({
        kind: "chat.message",
        provider: "mock",
        message: {
          id: "spoofed-command-field",
          viewer: { id: "a", displayName: "Same display name" },
          text: "ordinary chat text",
          occurredAt: "2026-10-26T12:00:00.000Z",
          command: { category: "body", choice: "golem" },
        },
      }),
    ).toBe(false);
    expect(vote("v4", "bad id with spaces", "!vote body golem")).toBe(false);
    expect(vote("v5", "a", "!vote body golem")).toBe(true);
    expect(vote("v5", "a", "!vote body drake")).toBe(false);
    expect(session.getState().categories[0]?.totalVotes).toBe(1);
    tick();
    expect(vote("late", "b", "!vote body drake")).toBe(false);
    expect(session.getState().categories[0]?.winner).toBe("golem");
    expect(vote("stale", "b", "!vote element fire", "mock", "2026-10-26T12:00:00.000Z")).toBe(
      false,
    );
    expect(vote("future", "b", "!vote element fire", "mock", "2026-10-26T12:00:06.000Z")).toBe(
      false,
    );
  });

  it("uses first choice when no ballots arrive and completes/restarts an entire cycle", () => {
    const { session, tick, vote } = setup();
    session.start(5);
    for (const choice of ["fire", "ember-burst", "water"]) {
      tick();
      const category = session.getState().activeCategory;
      if (category) vote(`vote-${category}`, "viewer", `!vote ${category} ${choice}`);
    }
    tick();
    expect(session.getState()).toMatchObject({
      status: "revealed",
      progress: 4,
      boss: {
        attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
      },
    });
    expect(session.getState().categories[0]?.noVoteFallback).toBe(true);
    session.reset();
    expect(session.getState().status).toBe("idle");
    session.start(5);
    expect(session.getState().cycleId).toBe("forge-2");
  });

  it("replays stale message IDs as rejected across a reset", () => {
    const { session, vote } = setup();
    session.start(5);
    expect(vote("repeat", "viewer", "!vote body golem")).toBe(true);
    session.reset();
    session.start(5);
    expect(vote("repeat", "viewer", "!vote body drake")).toBe(false);
    expect(session.getState().categories[0]?.totalVotes).toBe(0);
  });

  it("disposes an active timer when a cycle is reset", () => {
    const { session, tick, pendingTimers } = setup();
    session.start(5);
    expect(pendingTimers()).toBe(1);
    session.reset();
    expect(pendingTimers()).toBe(0);
    tick();
    expect(session.getState()).toMatchObject({ status: "idle", cycleId: null });
  });

  it("assembles deterministic names and bounded stats from all attributes", () => {
    const attrs = {
      body: "drake",
      element: "storm",
      special: "thunder-dash",
      weakness: "light",
    } as const;
    expect(assembleBoss(attrs, "forge-4")).toEqual(assembleBoss(attrs, "forge-4"));
    expect(assembleBoss(attrs, "forge-4")).toMatchObject({
      name: "Thunder Tempest",
      stats: { health: 250, damage: 24, attackIntervalMs: 1600 },
    });
  });
});
