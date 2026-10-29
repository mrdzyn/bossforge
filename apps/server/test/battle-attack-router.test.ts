import { describe, expect, it, vi } from "vitest";
import { BossBattleSession } from "../src/battle/boss-battle-session.js";
import { BattleAttackRouter } from "../src/battle/battle-attack-router.js";
import { createBossForgeApp } from "../src/app.js";
import type { NormalizedChatEvent } from "../src/events/normalized-chat-event.js";

const fixedDate = new Date("2026-10-29T12:00:00.000Z");
function appHeaders() {
  return { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" };
}

function completedMockForge(
  identity: {
    serverInstanceId: string;
    serverStartedAt: string;
    cycleId: string;
    mode: "mock";
  },
  weakness: "water" | "light" | "earth" | "wind" = "water",
) {
  const categories = ["body", "element", "special", "weakness"] as const;
  const choices = {
    body: ["golem", "wraith", "drake", "mimic"],
    element: ["fire", "ice", "storm", "void"],
    special: ["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"],
    weakness: ["water", "light", "earth", "wind"],
  } as const;
  const winners = {
    body: "golem",
    element: "fire",
    special: "ember-burst",
    weakness,
  } as const;
  return {
    ...identity,
    revision: 8,
    status: "revealed" as const,
    simulated: true,
    connectedToTwitch: false,
    durationSeconds: 15,
    startedAt: fixedDate.toISOString(),
    activeCategory: null,
    progress: 4,
    categories: categories.map((category) => ({
      category,
      status: "closed" as const,
      options: choices[category].map((choice) => ({
        choice,
        count: category === "weakness" && choice === winners[category] ? 1 : 0,
        percentage: category === "weakness" && choice === winners[category] ? 100 : 0,
      })),
      totalVotes: category === "weakness" ? 1 : 0,
      openedAt: fixedDate.toISOString(),
      closesAt: fixedDate.toISOString(),
      winner: winners[category],
      noVoteFallback: category !== "weakness",
    })),
    boss: {
      id: "boss",
      name: "Boss",
      attributes: { ...winners },
      stats: { health: 100, damage: 1, attackIntervalMs: 1000 },
    },
  };
}

function queuedBattleFixture(
  audienceBand: "low" | "high" = "low",
  weakness: "water" | "light" | "earth" | "wind" = "water",
) {
  let mono = 0;
  let deadlineTask: (() => void) | undefined;
  let drainTask: (() => void) | undefined;
  const identity = {
    serverInstanceId: "deadline-server",
    serverStartedAt: fixedDate.toISOString(),
    cycleId: "forge-1",
    mode: "mock" as const,
  };
  const battle = new BossBattleSession(
    identity.serverInstanceId,
    identity.serverStartedAt,
    {
      schedule(callback) {
        deadlineTask = callback;
        return () => {
          if (deadlineTask === callback) deadlineTask = undefined;
        };
      },
    },
    () => mono,
    () => fixedDate,
    () => "deadline-encounter",
  );
  const router = new BattleAttackRouter({
    battle,
    getProvider: () => "mock",
    getGeneration: () => 1,
    getForgeIdentity: () => identity,
    isTwitchVerified: () => false,
    monotonicNow: () => mono,
    hmacKey: Buffer.alloc(32, 9),
    scheduler: {
      schedule(callback) {
        drainTask = callback;
        return () => {
          if (drainTask === callback) drainTask = undefined;
        };
      },
    },
  });
  const ready = battle.onForgeState(completedMockForge(identity, weakness));
  battle.start(
    {
      requestId: "00000000-0000-4000-8000-000000000061",
      expectedRevision: ready.revision,
      forgeIdentity: identity,
      forgeCycleId: identity.cycleId,
      durationSeconds: 60,
      audienceBand,
    },
    true,
  );
  const send = (id: string, text = "!hit water") =>
    router.handle(
      {
        kind: "chat.message",
        provider: "mock",
        message: {
          id,
          viewer: { id: `viewer-${id}`, displayName: "Synthetic" },
          text,
          occurredAt: fixedDate.toISOString(),
        },
      },
      { provider: "mock", generation: 1, verified: true },
    );
  return {
    battle,
    router,
    send,
    setMono(value: number) {
      mono = value;
    },
    fireDeadline() {
      deadlineTask?.();
    },
    fireDrain() {
      drainTask?.();
    },
  };
}

describe("BattleAttackRouter", () => {
  it.each(["water", "light", "earth", "wind"] as const)(
    "applies base, matching and nonmatching damage for %s",
    (weakness) => {
      const f = queuedBattleFixture("low", weakness);
      const other = weakness === "water" ? "wind" : "water";
      f.send("base", "!hit");
      f.fireDrain();
      expect(f.battle.getState().currentHp).toBe(92);
      f.send("matching", `!hit ${weakness}`);
      f.fireDrain();
      expect(f.battle.getState().currentHp).toBe(78);
      f.send("other", `!hit ${other}`);
      f.fireDrain();
      expect(f.battle.getState()).toMatchObject({
        currentHp: 70,
        acceptedHitCount: 3,
        weaknessHitCount: 1,
        baseHitCount: 2,
      });
      f.router.close();
    },
  );

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
        if (stage === 3) {
          const vote = await app.app.inject({
            method: "POST",
            url: "/dev/simulation/events",
            headers,
            payload: {
              kind: "chat.message",
              provider: "mock",
              message: {
                id: "synthetic-weakness-vote",
                viewer: { id: "viewer-vote", displayName: "Viewer" },
                text: "!vote weakness water",
                occurredAt: fixedDate.toISOString(),
              },
            },
          });
          expect(vote.statusCode).toBe(202);
        }
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
      await vi.waitFor(async () => {
        const victory = (await app.app.inject({ method: "GET", url: "/battle/state" })).json();
        expect(victory).toMatchObject({
          status: "victory",
          currentHp: 0,
          acceptedHitCount: 8,
          weaknessHitCount: 8,
          damageApplied: 100,
        });
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
          options: choices.map((choice) => ({
            choice,
            count: category === "weakness" && choice === winner ? 1 : 0,
            percentage: category === "weakness" && choice === winner ? 100 : 0,
          })),
          totalVotes: category === "weakness" ? 1 : 0,
          openedAt: fixedDate.toISOString(),
          closesAt: fixedDate.toISOString(),
          winner,
          noVoteFallback: category !== "weakness",
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
      scheduler: {
        schedule(callback) {
          callback();
          return () => undefined;
        },
      },
    });
    router.onBattleState(battle.getState());
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
      setDeadlineDrain: () => undefined,
      isLateReceipt: () => false,
    } as unknown as BossBattleSession;
    let scheduledDrain: (() => void) | undefined;
    const router = new BattleAttackRouter({
      battle,
      getProvider: () => "mock",
      getGeneration: () => 1,
      getForgeIdentity: () => identity,
      isTwitchVerified: () => false,
      monotonicNow: () => mono,
      scheduler: {
        schedule(callback) {
          scheduledDrain = callback;
          return () => {
            if (scheduledDrain === callback) scheduledDrain = undefined;
          };
        },
      },
      hmacKey: Buffer.alloc(32, 3),
    });
    const internals = router as unknown as {
      queue: unknown[];
      replay: Map<string, number>;
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
    internals.queue.length = 0;
    scheduledDrain?.();
    mono += 10_000;
    const priorQueueFull = router.snapshot().reasons.queue_full;
    for (let index = 0; index < 65; index += 1) send(`queue-${index}`);
    expect(internals.queue).toHaveLength(64);
    expect(router.snapshot().reasons.queue_full).toBe(priorQueueFull + 1);
    mono += 501;
    scheduledDrain?.();
    expect(router.snapshot().reasons.queue_expired).toBe(64);
    router.close();
  });

  it.each(["deadline-first", "drain-first"] as const)(
    "resolves a queued lethal pre-deadline hit as victory when %s runs first",
    (order) => {
      const fixture = queuedBattleFixture();
      fixture.setMono(59_999);
      for (let index = 0; index < 8; index += 1) fixture.send(`lethal-${order}-${index}`);
      fixture.setMono(60_000);
      if (order === "deadline-first") {
        fixture.fireDeadline();
        fixture.fireDrain();
      } else {
        fixture.fireDrain();
        fixture.fireDeadline();
      }
      expect(fixture.battle.getState()).toMatchObject({
        status: "victory",
        currentHp: 0,
        acceptedHitCount: 8,
        damageApplied: 100,
      });
      expect(fixture.router.snapshot()).toMatchObject({ accepted: 8, reasons: { late: 0 } });
      fixture.router.close();
      fixture.battle.close();
    },
  );

  it("drains eligible queued damage before expiring when HP remains positive", () => {
    const fixture = queuedBattleFixture();
    fixture.setMono(59_999);
    fixture.send("surviving-hit");
    fixture.setMono(60_000);
    fixture.fireDeadline();
    expect(fixture.battle.getState()).toMatchObject({
      status: "expired",
      currentHp: 86,
      acceptedHitCount: 1,
      damageApplied: 14,
    });
    fixture.router.close();
    fixture.battle.close();
  });

  it("rejects exact-deadline and post-deadline receipts with the fixed late reason", () => {
    const fixture = queuedBattleFixture();
    fixture.setMono(60_000);
    fixture.send("exact-deadline");
    expect(fixture.battle.getState().status).toBe("expired");
    expect(fixture.router.snapshot()).toMatchObject({
      accepted: 0,
      rejected: 1,
      reasons: { late: 1, inactive: 0 },
    });
    fixture.setMono(60_001);
    fixture.send("after-deadline");
    expect(fixture.router.snapshot()).toMatchObject({
      accepted: 0,
      rejected: 2,
      reasons: { late: 2, inactive: 0 },
    });
    fixture.router.close();
    fixture.battle.close();
  });

  it("does not debit accepted-hit capacity when the session rejects a transition", () => {
    const fixture = queuedBattleFixture("high");
    const apply = fixture.battle.applyAcceptedDamage.bind(fixture.battle);
    let rejectOnce = true;
    fixture.battle.applyAcceptedDamage = (...args) => {
      if (rejectOnce) {
        rejectOnce = false;
        return null;
      }
      return apply(...args);
    };
    for (let index = 0; index < 18; index += 1) fixture.send(`token-${index}`);
    fixture.fireDrain();
    expect(fixture.router.snapshot()).toMatchObject({
      accepted: 16,
      rejected: 2,
      reasons: { inactive: 1, rate_limited: 1 },
    });
    expect(fixture.battle.getState()).toMatchObject({ acceptedHitCount: 16, currentHp: 776 });
    fixture.router.close();
    fixture.battle.close();
  });
});
