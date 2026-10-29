import { describe, expect, it } from "vitest";
import { FORGE_VOTE_CHOICES, type ForgeState } from "@bossforge/shared";
import { BossBattleSession } from "../src/battle/boss-battle-session.js";

const makeReveal = (
  mode: "mock" | "twitch" = "mock",
  serverInstanceId = "forge-server",
  serverStartedAt = "2026-10-29T00:00:00.000Z",
): ForgeState => {
  const winners = {
    body: "golem",
    element: "fire",
    special: "ember-burst",
    weakness: "water",
  } as const;
  return {
    serverInstanceId,
    serverStartedAt,
    revision: 8,
    cycleId: "forge-1",
    status: "revealed",
    mode,
    simulated: mode === "mock",
    connectedToTwitch: mode === "twitch",
    durationSeconds: 15,
    startedAt: "2026-10-29T00:00:00.000Z",
    activeCategory: null,
    progress: 4,
    categories: (["body", "element", "special", "weakness"] as const).map((category) => ({
      category,
      status: "closed",
      options: FORGE_VOTE_CHOICES[category].map((choice) => ({
        choice,
        count: 0,
        percentage: 0,
      })),
      totalVotes: 0,
      openedAt: "2026-10-29T00:00:00.000Z",
      closesAt: "2026-10-29T00:00:15.000Z",
      winner: winners[category],
      noVoteFallback: true,
    })),
    boss: {
      id: "boss-1",
      name: "Test Boss",
      attributes: { ...winners },
      stats: { health: 100, damage: 10, attackIntervalMs: 1000 },
    },
  };
};
const revealed = makeReveal();
const make = () => {
  let mono = 0;
  let wall = new Date("2026-10-29T00:00:00.000Z");
  let timer: (() => void) | undefined;
  let id = 0;
  const session = new BossBattleSession(
    "server",
    "2026-10-29T00:00:00.000Z",
    {
      schedule: (cb) => {
        timer = cb;
        return () => {
          timer = undefined;
        };
      },
    },
    () => mono,
    () => wall,
    () => `enc-${++id}`,
  );
  return {
    session,
    advance(ms: number) {
      mono += ms;
      wall = new Date(wall.getTime() + ms);
    },
    fire() {
      timer?.();
    },
  };
};
const start = (revision: number, requestId = "00000000-0000-4000-8000-000000000001") => ({
  requestId,
  expectedRevision: revision,
  forgeIdentity: {
    serverInstanceId: revealed.serverInstanceId,
    serverStartedAt: revealed.serverStartedAt,
    cycleId: revealed.cycleId!,
    mode: revealed.mode,
  },
  forgeCycleId: "forge-1",
  durationSeconds: 60 as const,
  audienceBand: "low" as const,
});
const startFor = (forge: ForgeState, revision: number, requestId: string) => ({
  ...start(revision, requestId),
  forgeIdentity: {
    serverInstanceId: forge.serverInstanceId,
    serverStartedAt: forge.serverStartedAt,
    cycleId: forge.cycleId!,
    mode: forge.mode,
  },
});

describe("BossBattleSession", () => {
  it("creates exactly one ready snapshot per reveal and does not start automatically", () => {
    const { session } = make();
    const first = session.onForgeState(revealed);
    expect(first.status).toBe("ready");
    expect(first.currentHp).toBeNull();
    expect(first.deadlineAt).toBeNull();
    expect(session.onForgeState(revealed).encounterId).toBe(first.encounterId);
  });
  it("rejects incomplete reveal state and cancels an active encounter on forge reset", () => {
    const { session } = make();
    const incomplete = {
      ...revealed,
      categories: revealed.categories.map((category, index) =>
        index === 3 ? { ...category, status: "pending" as const, winner: null } : category,
      ),
    };
    expect(session.onForgeState(incomplete).status).toBe("idle");
    const wrongOrder = { ...revealed, categories: [...revealed.categories].reverse() };
    expect(session.onForgeState(wrongOrder).status).toBe("idle");
    const invalidWinner = structuredClone(revealed);
    invalidWinner.categories[0]!.winner = "not-a-body-option";
    expect(make().session.onForgeState(invalidWinner).status).toBe("idle");
    const mismatchedBoss = structuredClone(revealed);
    if (!mismatchedBoss.boss) throw new Error("test reveal needs a boss");
    mismatchedBoss.boss.attributes.element = "ice";
    expect(make().session.onForgeState(mismatchedBoss).status).toBe("idle");
    session.onForgeState(revealed);
    session.start(start(1), true);
    session.onOwnerForgeReset();
    expect(session.getState()).toMatchObject({ status: "cancelled", cancelReason: "forge_reset" });
  });
  it("requires readiness, provider verification, matching revision and cycle", () => {
    const { session } = make();
    session.onForgeState(revealed);
    expect(session.start(start(1), false)).toMatchObject({
      ok: false,
      error: "provider_unverified",
    });
    expect(
      session.start(
        { ...start(0, "00000000-0000-4000-8000-000000000002"), forgeCycleId: "stale" },
        true,
      ),
    ).toMatchObject({ ok: false, error: "revision_conflict" });
    expect(session.start(start(1, "00000000-0000-4000-8000-000000000003"), true)).toMatchObject({
      ok: true,
      state: { status: "active", currentHp: 100, maxHp: 100 },
    });
  });
  it("returns identical idempotent retries and rejects key reuse with different arguments", () => {
    const { session } = make();
    session.onForgeState(revealed);
    const request = start(1);
    const accepted = session.start(request, true);
    expect(session.start(request, true)).toEqual(accepted);
    expect(session.start({ ...request, audienceBand: "medium" }, true)).toMatchObject({
      ok: false,
      error: "idempotency_conflict",
    });
  });
  it("serializes concurrent starts so only one request can begin the encounter", async () => {
    const { session } = make();
    session.onForgeState(revealed);
    const outcomes = await Promise.all([
      Promise.resolve().then(() =>
        session.start(start(1, "00000000-0000-4000-8000-000000000011"), true),
      ),
      Promise.resolve().then(() =>
        session.start(start(1, "00000000-0000-4000-8000-000000000012"), true),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toHaveLength(1);
    expect(session.getState().status).toBe("active");
  });
  it("expires at deadline despite an early scheduler callback and never extends the timer", () => {
    const clock = make();
    clock.session.onForgeState(revealed);
    clock.session.start(start(1), true);
    clock.fire();
    expect(clock.session.getState().status).toBe("active");
    clock.advance(60_000);
    clock.fire();
    expect(clock.session.getState()).toMatchObject({ status: "expired", currentHp: 100 });
    clock.advance(60_000);
    clock.fire();
    expect(clock.session.getState().status).toBe("expired");
  });
  it("clamps internal damage and keeps victory terminal", () => {
    const { session } = make();
    session.onForgeState(revealed);
    session.start(start(1), true);
    expect(session.applyDamageForTest(200, true)).toMatchObject({
      status: "victory",
      currentHp: 0,
      damageApplied: 100,
      acceptedHitCount: 1,
      weaknessHitCount: 1,
    });
    expect(session.applyDamageForTest(8).revision).toBe(session.getState().revision);
  });
  it("cancels on provider loss and does not resume when provider returns", () => {
    const { session } = make();
    session.onForgeState(revealed);
    session.start(start(1), true);
    session.setProviderReady(false);
    expect(session.getState()).toMatchObject({
      status: "cancelled",
      cancelReason: "twitch_disconnected",
    });
    session.setProviderReady(true);
    expect(session.getState().status).toBe("cancelled");
  });
  it.each([
    ["mock", "twitch", "mock-epoch", "twitch-epoch"],
    ["twitch", "mock", "twitch-epoch", "mock-epoch"],
  ] as const)(
    "accepts a fresh forge-1 after %s to %s provider transition",
    (oldMode, newMode, oldEpoch, newEpoch) => {
      const { session } = make();
      const previous = makeReveal(oldMode, oldEpoch, "2026-10-29T00:00:00.000Z");
      const firstReady = session.onForgeState(previous);
      expect(firstReady).toMatchObject({ status: "ready", forgeCycleId: "forge-1" });
      session.start(
        startFor(previous, firstReady.revision, `00000000-0000-4000-8000-000000000021`),
        true,
      );
      const cancelled = session.cancel("provider_changed");
      expect(cancelled).toMatchObject({ status: "cancelled", cancelReason: "provider_changed" });

      const nextForge = makeReveal(newMode, newEpoch, "2026-10-29T00:01:00.000Z");
      const nextReady = session.onForgeState(nextForge);
      expect(nextReady).toMatchObject({ status: "ready", forgeCycleId: "forge-1" });
      expect(nextReady.encounterId).not.toBe(firstReady.encounterId);
      expect(nextReady.forgeIdentity).toMatchObject({
        serverInstanceId: newEpoch,
        mode: newMode,
      });
      expect(
        session.start(
          startFor(nextForge, nextReady.revision, "00000000-0000-4000-8000-000000000022"),
          true,
        ),
      ).toMatchObject({
        ok: true,
        state: { status: "active" },
      });
      expect(session.onForgeState(previous).encounterId).toBe(nextReady.encounterId);
    },
  );
  it("retires a terminal encounter only through explicit owner reset", () => {
    const { session } = make();
    session.onForgeState(revealed);
    session.start(start(1), true);
    session.applyDamageForTest(100);
    expect(session.getState().status).toBe("victory");
    session.onOwnerForgeReset();
    expect(session.getState()).toMatchObject({ status: "idle", encounterId: null, revision: 4 });
  });
});
