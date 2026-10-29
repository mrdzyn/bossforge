import { describe, expect, it } from "vitest";
import {
  CommunityBattleStateV1Schema,
  OverlayBattleStateV1Schema,
  GENERIC_PROFILE_V1,
  GenericProfileV1Schema,
} from "../src/battle.js";
import { authoritativeCompletedReveal, FORGE_VOTE_CHOICES } from "../src/index.js";
import { BattleStateReconciler } from "../src/battle-state-reconciler.js";

const idle = (
  revision = 0,
  serverInstanceId = "server",
  serverStartedAt = "2026-10-29T00:00:00.000Z",
) =>
  CommunityBattleStateV1Schema.parse({
    schemaVersion: 1,
    serverInstanceId,
    serverStartedAt,
    revision,
    status: "idle",
    forgeIdentity: null,
    encounterId: null,
    forgeCycleId: null,
    bossSnapshot: null,
    profileId: null,
    profileVersion: null,
    profileSnapshot: null,
    audienceBand: null,
    durationSeconds: null,
    startedAt: null,
    deadlineAt: null,
    currentHp: null,
    maxHp: null,
    acceptedHitCount: 0,
    baseHitCount: 0,
    weaknessHitCount: 0,
    damageApplied: 0,
    cancelReason: null,
  });

describe("Generic v1 battle contracts", () => {
  it("strictly validates the data-only profile and rejects unknown keys", () => {
    expect(GenericProfileV1Schema.parse(GENERIC_PROFILE_V1).profileId).toBe("generic");
    expect(
      GenericProfileV1Schema.safeParse({ ...GENERIC_PROFILE_V1, script: "alert(1)" }).success,
    ).toBe(false);
  });
  it("enforces all nine bounded duration and audience HP values", () => {
    expect(GENERIC_PROFILE_V1.encounter.audienceHpByDuration).toEqual({
      "60": { low: 100, medium: 400, high: 1000 },
      "90": { low: 150, medium: 550, high: 1500 },
      "120": { low: 200, medium: 750, high: 2000 },
    });
  });
  it("enforces idle cross-field invariants", () => {
    expect(
      CommunityBattleStateV1Schema.safeParse({ ...idle(), encounterId: "stale" }).success,
    ).toBe(false);
  });
});

describe("authoritative completed forge reveal", () => {
  const reveal = () => {
    const winners = {
      body: "golem",
      element: "fire",
      special: "ember-burst",
      weakness: "water",
    } as const;
    return {
      serverInstanceId: "forge-server",
      serverStartedAt: "2026-10-29T00:00:00.000Z",
      revision: 8,
      cycleId: "forge-1",
      status: "revealed",
      mode: "mock",
      simulated: true,
      connectedToTwitch: false,
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
  it("accepts ordered winners and matching server-authored attributes, including valid defaults", () => {
    expect(authoritativeCompletedReveal(reveal())?.boss.attributes.weakness).toBe("water");
  });
  it("rejects an out-of-options winner and a boss attribute mismatch", () => {
    const valid = reveal();
    const badWinner = structuredClone(valid);
    badWinner.categories[1]!.winner = "void-not-configured" as never;
    expect(authoritativeCompletedReveal(badWinner)).toBeNull();
    const badBoss = structuredClone(valid);
    badBoss.boss.attributes.element = "ice";
    expect(authoritativeCompletedReveal(badBoss)).toBeNull();
  });
});

describe("BattleStateReconciler", () => {
  it("reconciles the strict overlay projection without dashboard profile fields", () => {
    const overlay = Object.fromEntries(
      Object.entries(idle()).filter(
        ([key]) => !["profileId", "profileVersion", "profileSnapshot"].includes(key),
      ),
    );
    const projected = OverlayBattleStateV1Schema.parse(overlay);
    const r = new BattleStateReconciler<typeof projected>();
    const generation = r.beginConnection();
    expect(r.apply(projected, generation, "snapshot")).toBe(true);
    expect(r.state).toEqual(projected);
  });
  it("requires current-generation overlay snapshots before adopting a new server epoch", () => {
    const overlay = (source: ReturnType<typeof idle>) =>
      OverlayBattleStateV1Schema.parse(
        Object.fromEntries(
          Object.entries(source).filter(
            ([key]) => !["profileId", "profileVersion", "profileSnapshot"].includes(key),
          ),
        ),
      );
    const r = new BattleStateReconciler<ReturnType<typeof overlay>>();
    const g1 = r.beginConnection();
    const first = overlay(idle());
    expect(r.apply(first, g1, "snapshot")).toBe(true);
    const g2 = r.beginConnection();
    const replacement = overlay(idle(0, "replacement", "2026-10-30T00:00:00.000Z"));
    expect(r.apply(replacement, g2, "websocket")).toBe(false);
    expect(r.apply(replacement, g2, "snapshot")).toBe(true);
    expect(r.apply(first, g1, "snapshot")).toBe(false);
    expect(r.state).toEqual(replacement);
  });
  it("requires an HTTP snapshot before first adoption and rejects stale generations and revisions", () => {
    const r = new BattleStateReconciler();
    const g1 = r.beginConnection();
    expect(r.apply(idle(), g1, "websocket")).toBe(false);
    expect(r.apply(idle(), g1, "snapshot")).toBe(true);
    expect(r.apply(idle(1), g1, "websocket")).toBe(true);
    expect(r.apply(idle(), g1, "snapshot")).toBe(false);
    const g2 = r.beginConnection();
    expect(r.state).toBeNull();
    expect(r.apply(idle(2), g1, "snapshot")).toBe(false);
    expect(r.apply(idle(0, "new", "2026-10-30T00:00:00.000Z"), g2, "websocket")).toBe(false);
    expect(r.apply(idle(0, "new", "2026-10-30T00:00:00.000Z"), g2, "snapshot")).toBe(true);
  });
  it("accepts identical equal revisions but rejects conflicting equal revisions", () => {
    const r = new BattleStateReconciler();
    const g = r.beginConnection();
    const s = idle();
    expect(r.apply(s, g, "snapshot")).toBe(true);
    expect(r.apply(s, g, "websocket")).toBe(true);
    expect(r.apply(idle(0, "other"), g, "websocket")).toBe(false);
  });
  it("requires a fresh same-generation HTTP snapshot after reconnect or feed invalidation", () => {
    const r = new BattleStateReconciler();
    const g1 = r.beginConnection();
    expect(r.apply(idle(), g1, "snapshot")).toBe(true);
    const g2 = r.beginConnection();
    expect(r.apply(idle(1), g2, "websocket")).toBe(false);
    expect(r.state).toBeNull();
    expect(r.apply(idle(), g2, "snapshot")).toBe(true);
    expect(r.apply(idle(1), g2, "websocket")).toBe(true);
    r.invalidate();
    expect(r.apply(idle(2), g2, "websocket")).toBe(false);
    expect(r.apply(idle(2), g2, "snapshot")).toBe(true);
  });
  it("rejects a retired encounter if a delayed frame attempts to resurrect it", () => {
    const r = new BattleStateReconciler();
    const generation = r.beginConnection();
    const ready = CommunityBattleStateV1Schema.parse({
      ...idle(1),
      status: "ready",
      forgeIdentity: {
        serverInstanceId: "forge-server",
        serverStartedAt: "2026-10-29T00:00:00.000Z",
        cycleId: "forge-1",
        mode: "mock",
      },
      encounterId: "enc-1",
      forgeCycleId: "forge-1",
      bossSnapshot: {
        id: "boss",
        name: "Boss",
        attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
      },
      profileId: "generic",
      profileVersion: 1,
      profileSnapshot: GENERIC_PROFILE_V1,
    });
    expect(r.apply(ready, generation, "snapshot")).toBe(true);
    expect(r.apply(idle(2), generation, "snapshot")).toBe(true);
    expect(r.apply({ ...ready, revision: 3 }, generation, "websocket")).toBe(false);
  });

  it.each([
    ["start", "same-process", "ready"],
    ["cancel", "same-process", "active"],
    ["start", "new-process", "idle"],
    ["cancel", "new-process", "idle"],
  ] as const)(
    "rejects a delayed G1 %s response after G2 adopts fresh %s state",
    async (kind, processChange, g2Status) => {
      const r = new BattleStateReconciler();
      class FakeBattleWebSocket {
        generation = 0;
        open() {
          this.generation = r.beginConnection();
          return this.generation;
        }
        receiveSnapshot(state: CommunityBattleStateV1) {
          return r.apply(state, this.generation, "snapshot");
        }
        close() {
          r.invalidate();
        }
      }
      const socket = new FakeBattleWebSocket();
      socket.open();
      const forgeIdentity = {
        serverInstanceId: "forge-server",
        serverStartedAt: "2026-10-29T00:00:00.000Z",
        cycleId: "forge-1",
        mode: "mock" as const,
      };
      const ready = CommunityBattleStateV1Schema.parse({
        ...idle(1),
        status: "ready",
        forgeIdentity,
        encounterId: "enc-1",
        forgeCycleId: "forge-1",
        bossSnapshot: {
          id: "boss-1",
          name: "Boss",
          attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
        },
        profileId: "generic",
        profileVersion: 1,
        profileSnapshot: GENERIC_PROFILE_V1,
      });
      const active = CommunityBattleStateV1Schema.parse({
        ...ready,
        revision: 2,
        status: "active",
        audienceBand: "low",
        durationSeconds: 60,
        startedAt: "2026-10-29T00:00:00.000Z",
        deadlineAt: "2026-10-29T00:01:00.000Z",
        currentHp: 100,
        maxHp: 100,
      });
      const cancelled = CommunityBattleStateV1Schema.parse({
        ...active,
        revision: 3,
        status: "cancelled",
        cancelReason: "owner_cancelled",
      });
      expect(socket.receiveSnapshot(kind === "cancel" ? active : ready)).toBe(true);
      const context = r.captureMutationContext(kind);
      expect(context).not.toBeNull();
      let resolveResponse!: (state: CommunityBattleStateV1) => void;
      const deferredResponse = new Promise<CommunityBattleStateV1>((resolve) => {
        resolveResponse = resolve;
      });
      const pendingMutation = deferredResponse.then((response) => {
        if (!r.isMutationResponseForContext(context!, response)) return false;
        return r.apply(response, context!.generation, "mutation");
      });

      socket.close();
      const g2Socket = new FakeBattleWebSocket();
      g2Socket.open();
      const freshG2 =
        processChange === "same-process"
          ? kind === "start"
            ? ready
            : active
          : idle(0, "new-server", "2026-10-30T00:00:00.000Z");
      expect(g2Socket.receiveSnapshot(freshG2)).toBe(true);
      expect(r.state?.status).toBe(g2Status);

      resolveResponse(kind === "start" ? active : cancelled);
      expect(await pendingMutation).toBe(false);
      expect(r.state?.status).toBe(g2Status);
    },
  );
});
