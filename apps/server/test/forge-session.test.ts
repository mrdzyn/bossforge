import { describe, expect, it } from "vitest";
import { ForgeSession, type ForgeScheduler } from "../src/forge/forge-session.js";
import { assembleBoss } from "../src/forge/boss-assembly.js";
import { EventSubDiagnostics } from "../src/twitch/eventsub-diagnostics.js";

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

  it.each(["water", "light", "earth", "wind"])("uses the actual %s weakness vote", (weakness) => {
    const { session, tick, vote } = setup();
    session.start(5);
    tick();
    tick();
    tick();
    expect(vote(`weakness-${weakness}`, "viewer", `!vote weakness ${weakness}`)).toBe(true);
    tick();
    expect(session.getState()).toMatchObject({
      status: "revealed",
      boss: { attributes: { weakness } },
    });
    expect(session.getState().categories[3]).toMatchObject({
      winner: weakness,
      noVoteFallback: false,
      totalVotes: 1,
    });
  });

  it("breaks tied weakness votes using configured choice order", () => {
    const { session, tick, vote } = setup();
    session.start(5);
    tick();
    tick();
    tick();
    expect(vote("tie-wind", "a", "!vote weakness wind")).toBe(true);
    expect(vote("tie-light", "b", "!vote weakness light")).toBe(true);
    tick();
    expect(session.getState().boss?.attributes.weakness).toBe("light");
  });

  it("opens exactly one retry for zero valid weakness ballots and accepts its audience vote", () => {
    const { session, tick, vote, pendingTimers } = setup();
    session.start(5);
    tick();
    tick();
    tick();
    expect(vote("invalid-first", "viewer", "!vote weakness nonsense")).toBe(false);
    const first = session.getState().categories[3]!.closesAt;
    tick();
    const retry = session.getState();
    expect(retry).toMatchObject({
      status: "voting",
      activeCategory: "weakness",
      weaknessRetry: true,
      boss: null,
    });
    expect(retry.categories[3]!.closesAt).not.toBe(first);
    expect(pendingTimers()).toBe(1);
    expect(vote("retry-earth", "viewer", "!vote weakness earth")).toBe(true);
    tick();
    expect(session.getState()).toMatchObject({
      status: "revealed",
      boss: { attributes: { weakness: "earth" } },
    });
  });

  it("ends safely after two empty weakness windows and can be explicitly reset", () => {
    const { session, tick, vote, pendingTimers } = setup();
    session.start(5);
    tick();
    tick();
    tick();
    tick();
    expect(vote("invalid-retry", "viewer", "!vote weakness unknown")).toBe(false);
    tick();
    expect(session.getState()).toMatchObject({
      status: "failed",
      activeCategory: null,
      progress: 3,
      boss: null,
      weaknessRetry: true,
    });
    expect(session.getState().categories[3]).toMatchObject({
      status: "closed",
      winner: null,
      noVoteFallback: false,
      totalVotes: 0,
    });
    expect(pendingTimers()).toBe(0);
    expect(vote("late", "viewer", "!vote weakness water")).toBe(false);
    session.reset();
    session.start(5);
    expect(session.getState()).toMatchObject({
      status: "voting",
      cycleId: "forge-2",
      weaknessRetry: false,
    });
  });

  it("cancels the retry without revealing a boss", () => {
    const { session, tick, pendingTimers } = setup();
    session.start(5);
    tick();
    tick();
    tick();
    tick();
    expect(session.getState().weaknessRetry).toBe(true);
    session.reset();
    tick();
    expect(session.getState()).toMatchObject({ status: "idle", boss: null, weaknessRetry: false });
    expect(pendingTimers()).toBe(0);
  });

  it("cancels a Twitch retry on verified disconnect and does not resume", () => {
    let now = Date.parse("2026-10-26T12:00:00.000Z");
    const callbacks: Array<() => void> = [];
    const session = new ForgeSession(
      () => new Date(now),
      {
        schedule(callback) {
          callbacks.push(callback);
          return () => undefined;
        },
      },
      () => undefined,
      "instance",
      undefined,
      "twitch",
      true,
    );
    session.start(5);
    for (let i = 0; i < 4; i++) {
      now += 5000;
      callbacks.at(-1)!();
    }
    expect(session.getState()).toMatchObject({ status: "voting", weaknessRetry: true });
    const stale = callbacks.at(-1)!;
    session.setTwitchConnected(false);
    stale();
    expect(session.getState()).toMatchObject({
      status: "idle",
      boss: null,
      connectedToTwitch: false,
    });
    session.setTwitchConnected(true);
    expect(session.getState()).toMatchObject({ status: "idle", boss: null });
    session.close();
  });

  it("ignores a queued callback from the previous weakness window", () => {
    let now = Date.parse("2026-10-26T12:00:00.000Z");
    const callbacks: Array<() => void> = [];
    const session = new ForgeSession(() => new Date(now), {
      schedule(callback) {
        callbacks.push(callback);
        return () => undefined;
      },
    });
    session.start(5);
    for (let i = 0; i < 3; i++) {
      now += 5000;
      callbacks.at(-1)!();
    }
    const old = callbacks.at(-1)!;
    now += 5000;
    old();
    expect(session.getState()).toMatchObject({ status: "voting", weaknessRetry: true });
    old();
    expect(session.getState()).toMatchObject({
      status: "voting",
      activeCategory: "weakness",
      weaknessRetry: true,
    });
    session.close();
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

  it("isolates Twitch and mock ballots by explicit forge mode and connection status", () => {
    const now = () => new Date("2026-10-26T12:00:00.000Z");
    const scheduler: ForgeScheduler = { schedule: () => () => undefined };
    const live = new ForgeSession(
      now,
      scheduler,
      () => undefined,
      "live-instance",
      undefined,
      "twitch",
      true,
    );
    expect(live.getState()).toMatchObject({
      mode: "twitch",
      simulated: false,
      connectedToTwitch: true,
    });
    live.start(15);
    const event = (provider: "mock" | "twitch") => ({
      kind: "chat.message" as const,
      provider,
      message: {
        id: `message-${provider}`,
        viewer: { id: "123456", displayName: "Viewer" },
        text: "!vote body drake",
        occurredAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(live.handleEvent(event("mock"))).toBe(false);
    expect(live.handleEvent(event("twitch"))).toBe(true);
    live.setTwitchConnected(false);
    expect(live.getState()).toMatchObject({
      mode: "twitch",
      simulated: false,
      connectedToTwitch: false,
      status: "idle",
    });
    live.setTwitchConnected(true);
    expect(live.getState()).toMatchObject({
      connectedToTwitch: true,
      status: "idle",
      activeCategory: null,
      progress: 0,
    });
    expect(
      live.handleEvent({
        ...event("twitch"),
        message: { ...event("twitch").message, id: "after-disconnect" },
      }),
    ).toBe(false);
    live.close();
  });

  it("cancels the active Twitch timer on connection loss and does not resume after reconnect", () => {
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
    const session = new ForgeSession(
      () => new Date(millis),
      scheduler,
      () => undefined,
      "live-session",
      undefined,
      "twitch",
      true,
    );
    session.start(15);
    expect(session.getState()).toMatchObject({ status: "voting", activeCategory: "body" });
    expect(callbacks).toHaveLength(1);

    session.setTwitchConnected(false);
    expect(session.getState()).toMatchObject({
      status: "idle",
      activeCategory: null,
      connectedToTwitch: false,
      progress: 0,
    });
    expect(callbacks).toHaveLength(0);

    session.setTwitchConnected(true);
    expect(session.getState()).toMatchObject({
      status: "idle",
      activeCategory: null,
      connectedToTwitch: true,
      progress: 0,
    });
    millis += 5000;
    callbacks.shift()?.();
    expect(session.getState().status).toBe("idle");
  });

  it("counts accepted and rejected live ballot outcomes without retaining event data", () => {
    const diagnostics = new EventSubDiagnostics();
    const session = new ForgeSession(
      () => new Date("2026-10-26T12:00:00.000Z"),
      { schedule: () => () => undefined },
      () => undefined,
      "diagnostic-test",
      undefined,
      "twitch",
      true,
      (reason) => diagnostics.recordBallot(reason),
    );
    session.start(15);
    const twitchEvent = (id: string, text: string) => ({
      kind: "chat.message" as const,
      provider: "twitch" as const,
      message: {
        id,
        viewer: { id: "viewer-id", displayName: "Viewer" },
        text,
        occurredAt: "2026-10-26T12:00:00.000Z",
      },
    });
    expect(session.handleEvent(twitchEvent("message-id", "!vote body drake"))).toBe(true);
    expect(session.handleEvent(twitchEvent("message-id", "!vote body drake"))).toBe(false);
    expect(session.handleEvent(twitchEvent("wrong-category", "!vote element fire"))).toBe(false);
    expect(diagnostics.snapshot()).toMatchObject({
      counters: { ballotsAccepted: 1, ballotsRejected: 2 },
      ballotReasons: { accepted: 1, "duplicate-message": 1, "wrong-category": 1 },
    });
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("message-id");
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("viewer-id");
    session.close();
  });
});
