import { describe, expect, it } from "vitest";
import { BossBattleSession } from "../src/battle/boss-battle-session.js";
import { BattleAttackRouter } from "../src/battle/battle-attack-router.js";
import { createBossForgeApp } from "../src/app.js";
import type { NormalizedChatEvent } from "../src/events/normalized-chat-event.js";

const fixedDate = new Date("2026-10-29T12:00:00.000Z");
function appHeaders() {
  return { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" };
}

describe("BattleAttackRouter", () => {
  it("runs a complete mock forge through actual simulation routes to community victory", async () => {
    let timer: (() => void) | undefined;
    const mono = 0;
    const app = await createBossForgeApp({
      mode: "development",
      now: () => fixedDate,
      battleMonotonicNow: () => mono,
      forgeScheduler: {
        schedule(callback) {
          timer = callback;
          return () => {
            if (timer === callback) timer = undefined;
          };
        },
      },
    });
    try {
      const headers = appHeaders();
      const startForge = await app.app.inject({
        method: "POST",
        url: "/dev/forge/start",
        headers,
        payload: { durationSeconds: 5 },
      });
      expect(startForge.statusCode).toBe(200);
      for (let stage = 0; stage < 4; stage += 1) {
        const closeStage = timer;
        expect(closeStage).toBeTypeOf("function");
        timer = undefined;
        closeStage!();
      }
      const ready = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      expect(ready.status).toBe("ready");
      const started = await app.app.inject({
        method: "POST",
        url: "/dev/battle/start",
        headers,
        payload: {
          requestId: "00000000-0000-4000-8000-000000000051",
          expectedRevision: ready.revision,
          forgeIdentity: ready.forgeIdentity,
          forgeCycleId: ready.forgeCycleId,
          durationSeconds: 60,
          audienceBand: "low",
        },
      });
      expect(started.statusCode).toBe(200);
      expect(started.json()).toMatchObject({ status: "active", currentHp: 100, maxHp: 100 });

      for (let index = 0; index < 8; index += 1) {
        const response = await app.app.inject({
          method: "POST",
          url: "/dev/simulation/events",
          headers,
          payload: {
            kind: "chat.message",
            provider: "mock",
            message: {
              id: `synthetic-hit-${index}`,
              viewer: { id: `viewer-${index}`, displayName: `Viewer ${index}` },
              text: "!hit water",
              occurredAt: fixedDate.toISOString(),
            },
          },
        });
        expect(response.statusCode).toBe(202);
      }
      const victory = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      expect(victory).toMatchObject({
        status: "victory",
        currentHp: 0,
        acceptedHitCount: 8,
        weaknessHitCount: 8,
        damageApplied: 100,
      });
      expect(
        (
          await app.app.inject({
            method: "POST",
            url: "/dev/battle/damage",
            headers,
            payload: { damage: 1 },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("applies base, matching and mismatched weakness damage, reserves replay IDs and enforces cooldown", () => {
    let mono = 0;
    let id = 0;
    const identity = {
      serverInstanceId: "s",
      serverStartedAt: fixedDate.toISOString(),
      cycleId: "forge-1",
      mode: "mock" as const,
    };
    const battle = new BossBattleSession(
      "s",
      fixedDate.toISOString(),
      { schedule: () => () => undefined },
      () => mono,
      () => fixedDate,
      () => `enc-${++id}`,
    );
    const forge = {
      serverInstanceId: "s",
      serverStartedAt: fixedDate.toISOString(),
      revision: 8,
      cycleId: "forge-1",
      status: "revealed" as const,
      mode: "mock" as const,
      simulated: true,
      connectedToTwitch: false,
      durationSeconds: 15,
      startedAt: fixedDate.toISOString(),
      activeCategory: null,
      progress: 4,
      categories: (["body", "element", "special", "weakness"] as const).map((category, index) => {
        const choices = {
          body: ["golem", "wraith", "drake", "mimic"],
          element: ["fire", "ice", "storm", "void"],
          special: ["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"],
          weakness: ["water", "light", "earth", "wind"],
        }[category];
        const winner = ["golem", "fire", "ember-burst", "water"][index]!;
        return {
          category,
          status: "closed" as const,
          options: choices.map((choice) => ({ choice, count: 0, percentage: 0 })),
          totalVotes: 0,
          openedAt: fixedDate.toISOString(),
          closesAt: fixedDate.toISOString(),
          winner,
          noVoteFallback: true,
        };
      }),
      boss: {
        id: "boss",
        name: "Boss",
        attributes: {
          body: "golem" as const,
          element: "fire" as const,
          special: "ember-burst" as const,
          weakness: "water" as const,
        },
        stats: { health: 100, damage: 1, attackIntervalMs: 1000 },
      },
    };
    const ready = battle.onForgeState(forge);
    expect(
      battle.start(
        {
          requestId: "00000000-0000-4000-8000-000000000052",
          expectedRevision: ready.revision,
          forgeIdentity: identity,
          forgeCycleId: "forge-1",
          durationSeconds: 60,
          audienceBand: "high",
        },
        true,
      ).ok,
    ).toBe(true);
    const router = new BattleAttackRouter({
      battle,
      getProvider: () => "mock",
      getGeneration: () => 1,
      getForgeIdentity: () => identity,
      isTwitchVerified: () => false,
      monotonicNow: () => mono,
      hmacKey: Buffer.alloc(32, 1),
    });
    const send = (id: string, viewer: string, text: string) =>
      router.handle(
        {
          kind: "chat.message",
          provider: "mock",
          message: {
            id,
            viewer: { id: viewer, displayName: "Private Name" },
            text,
            occurredAt: fixedDate.toISOString(),
          },
        },
        { provider: "mock", generation: 1, verified: true },
      );
    send("1", "v1", "!hit");
    expect(battle.getState().currentHp).toBe(992);
    send("1", "v2", "!hit water");
    expect(battle.getState().currentHp).toBe(992);
    send("2", "v1", "!hit light");
    expect(battle.getState().currentHp).toBe(992);
    mono = 2000;
    send("3", "v1", "!hit light");
    expect(battle.getState().currentHp).toBe(984);
    send("4", "v2", "!hit water");
    expect(battle.getState().currentHp).toBe(970);
    for (let index = 0; index < 14; index += 1)
      send(`rate-${index}`, `rate-viewer-${index}`, "!hit");
    expect(router.snapshot().accepted).toBe(17);
    const beforeRateLimit = battle.getState().currentHp;
    send("rate-limited", "rate-viewer-overflow", "!hit");
    expect(battle.getState().currentHp).toBe(beforeRateLimit);
    expect(router.snapshot().reasons.rate_limited).toBe(1);
    const internals = router as unknown as { cooldowns: Map<string, number> };
    for (let index = internals.cooldowns.size; index < 5_000; index += 1)
      internals.cooldowns.set(`pseudonym-${index}`, 1_000_000);
    send("busy", "new-viewer-over-cap", "!hit");
    expect(router.snapshot().reasons.busy).toBe(1);
    expect(router.snapshot()).toMatchObject({
      accepted: 17,
      base: 16,
      weakness: 1,
      weaknessMismatch: 1,
      rejected: 4,
    });
    router.close();
  });

  it("rejects retired source generations before any private event is consumed", () => {
    const mono = 0;
    const battle = new BossBattleSession(
      "s",
      fixedDate.toISOString(),
      { schedule: () => () => undefined },
      () => mono,
      () => fixedDate,
      () => "enc-1",
    );
    // Retired-source checks happen before battle state or message IDs are consumed.
    const router = new BattleAttackRouter({
      battle,
      getProvider: () => "mock",
      getGeneration: () => 2,
      getForgeIdentity: () => null,
      isTwitchVerified: () => false,
      monotonicNow: () => mono,
    });
    const event: NormalizedChatEvent = {
      kind: "chat.message",
      provider: "twitch",
      message: {
        id: "stale",
        viewer: { id: "viewer", displayName: "Private" },
        text: "!hit",
        occurredAt: fixedDate.toISOString(),
      },
    };
    router.handle(event, { provider: "twitch", generation: 1, verified: true });
    expect(router.snapshot().reasons.wrong_provider).toBe(1);
    router.close();
  });

  it("requires the current verified Twitch subscription lease", () => {
    const battle = new BossBattleSession(
      "s",
      fixedDate.toISOString(),
      { schedule: () => () => undefined },
      () => 0,
      () => fixedDate,
      () => "enc-1",
    );
    const router = new BattleAttackRouter({
      battle,
      getProvider: () => "twitch",
      getGeneration: () => 7,
      getForgeIdentity: () => null,
      isTwitchVerified: () => false,
      monotonicNow: () => 0,
      hmacKey: Buffer.alloc(32, 2),
    });
    router.handle(
      {
        kind: "chat.message",
        provider: "twitch",
        message: {
          id: "not-verified",
          viewer: { id: "viewer-1", displayName: "private" },
          text: "!hit",
          occurredAt: fixedDate.toISOString(),
        },
      },
      { provider: "twitch", generation: 7, verified: true },
    );
    expect(router.snapshot()).toMatchObject({ accepted: 0, rejected: 1, reasons: { inactive: 1 } });
    router.close();
  });

  it("enforces ingress burst/refill, replay TTL/capacity, queue cap and maximum queue age", () => {
    let mono = 0;
    const identity = {
      serverInstanceId: "s",
      serverStartedAt: fixedDate.toISOString(),
      cycleId: "c",
      mode: "mock" as const,
    };
    const activeState = {
      status: "active",
      encounterId: "enc-1",
      forgeIdentity: identity,
    } as never;
    const battle = {
      getStateForReceipt: () => activeState,
      applyAcceptedDamage: () => activeState,
    } as unknown as BossBattleSession;
    const router = new BattleAttackRouter({
      battle,
      getProvider: () => "mock",
      getGeneration: () => 1,
      getForgeIdentity: () => identity,
      isTwitchVerified: () => false,
      monotonicNow: () => mono,
      hmacKey: Buffer.alloc(32, 3),
    });
    const internals = router as unknown as {
      draining: boolean;
      queue: unknown[];
      replay: Map<string, number>;
      drain(): void;
    };
    const send = (id: string) =>
      router.handle(
        {
          kind: "chat.message",
          provider: "mock",
          message: {
            id,
            viewer: { id: `viewer-${id}`, displayName: "Synthetic" },
            text: "!hit",
            occurredAt: fixedDate.toISOString(),
          },
        },
        { provider: "mock", generation: 1, verified: true },
      );

    for (let index = 0; index < 101; index += 1) send(`burst-${index}`);
    expect(router.snapshot().reasons.rate_limited).toBe(1);
    mono = 1000;
    send("after-refill");
    expect(router.snapshot().reasons.rate_limited).toBe(1);

    send("replay-once");
    send("replay-once");
    expect(router.snapshot().reasons.duplicate).toBe(1);
    mono = 601_000;
    send("replay-once");
    expect(router.snapshot().reasons.duplicate).toBe(1);

    internals.replay.clear();
    for (let index = 0; index < 10_000; index += 1)
      internals.replay.set(`reserved-${index}`, mono + 60_000);
    send("replay-capacity");
    expect(router.snapshot().reasons.replay_capacity).toBe(1);

    internals.replay.clear();
    mono += 10_000;
    internals.draining = true;
    for (let index = 0; index < 65; index += 1) send(`queue-${index}`);
    expect(internals.queue).toHaveLength(64);
    expect(router.snapshot().reasons.queue_full).toBe(1);
    mono += 501;
    internals.draining = false;
    internals.drain();
    expect(router.snapshot().reasons.queue_expired).toBe(64);
    router.close();
  });

  it("accepts a pre-deadline receipt and excludes an attack exactly at the deadline", async () => {
    let timer: (() => void) | undefined;
    let mono = 0;
    const app = await createBossForgeApp({
      mode: "development",
      now: () => fixedDate,
      battleMonotonicNow: () => mono,
      forgeScheduler: {
        schedule(callback) {
          timer = callback;
          return () => {
            if (timer === callback) timer = undefined;
          };
        },
      },
    });
    try {
      const headers = appHeaders();
      await app.app.inject({
        method: "POST",
        url: "/dev/forge/start",
        headers,
        payload: { durationSeconds: 5 },
      });
      for (let stage = 0; stage < 4; stage += 1) {
        const closeStage = timer;
        timer = undefined;
        closeStage!();
      }
      const ready = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
      await app.app.inject({
        method: "POST",
        url: "/dev/battle/start",
        headers,
        payload: {
          requestId: "00000000-0000-4000-8000-000000000053",
          expectedRevision: ready.revision,
          forgeIdentity: ready.forgeIdentity,
          forgeCycleId: ready.forgeCycleId,
          durationSeconds: 60,
          audienceBand: "low",
        },
      });
      const send = (id: string) =>
        app.app.inject({
          method: "POST",
          url: "/dev/simulation/events",
          headers,
          payload: {
            kind: "chat.message",
            provider: "mock",
            message: {
              id,
              viewer: { id: `viewer-${id}`, displayName: "Synthetic" },
              text: "!hit water",
              occurredAt: fixedDate.toISOString(),
            },
          },
        });
      mono = 59_999;
      expect((await send("before-deadline")).statusCode).toBe(202);
      expect((await app.app.inject({ method: "GET", url: "/battle/state" })).json()).toMatchObject({
        status: "active",
        currentHp: 86,
        acceptedHitCount: 1,
      });
      mono = 60_000;
      expect((await send("at-deadline")).statusCode).toBe(202);
      expect((await app.app.inject({ method: "GET", url: "/battle/state" })).json()).toMatchObject({
        status: "expired",
        currentHp: 86,
        acceptedHitCount: 1,
      });
    } finally {
      await app.close();
    }
  });
});
