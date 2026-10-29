import { describe, expect, it } from "vitest";
import {
  CommunityBattleStateV1Schema,
  GENERIC_PROFILE_V1,
  GenericProfileV1Schema,
} from "../src/battle.js";
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

describe("BattleStateReconciler", () => {
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
});
