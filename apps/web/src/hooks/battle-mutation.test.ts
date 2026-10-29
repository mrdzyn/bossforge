import { describe, expect, it, vi } from "vitest";
import {
  BattleStateReconciler,
  CommunityBattleStateV1Schema,
  GENERIC_PROFILE_V1,
  type CommunityBattleStateV1,
} from "@bossforge/shared";
import { sendBattleMutation } from "./battle-mutation.js";

const base = {
  schemaVersion: 1,
  serverInstanceId: "app-server",
  serverStartedAt: "2026-10-29T00:00:00.000Z",
  revision: 0,
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
} as const;
const identity = {
  serverInstanceId: "forge-server",
  serverStartedAt: "2026-10-29T00:00:00.000Z",
  cycleId: "forge-1",
  mode: "mock" as const,
};
const ready = (
  revision = 1,
  encounterId = "enc-1",
  process = "app-server",
  startedAt = base.serverStartedAt,
) =>
  CommunityBattleStateV1Schema.parse({
    ...base,
    serverInstanceId: process,
    serverStartedAt: startedAt,
    revision,
    status: "ready",
    forgeIdentity: identity,
    encounterId,
    forgeCycleId: "forge-1",
    bossSnapshot: {
      id: "boss-1",
      name: "Test Boss",
      attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
    },
    profileId: "generic",
    profileVersion: 1,
    profileSnapshot: GENERIC_PROFILE_V1,
  });
const active = (revision = 2) =>
  CommunityBattleStateV1Schema.parse({
    ...ready(),
    revision,
    status: "active",
    audienceBand: "low",
    durationSeconds: 60,
    startedAt: "2026-10-29T00:00:00.000Z",
    deadlineAt: "2026-10-29T00:01:00.000Z",
    currentHp: 100,
    maxHp: 100,
  });
const cancelled = (revision = 3) =>
  CommunityBattleStateV1Schema.parse({
    ...active(),
    revision,
    status: "cancelled",
    cancelReason: "owner_cancelled",
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("battle mutation response fencing", () => {
  it.each([
    ["start", "same-process", "ready"],
    ["cancel", "same-process", "active"],
    ["start", "new-process", "idle"],
    ["cancel", "new-process", "idle"],
  ] as const)(
    "ignores deferred G1 %s fetch after a fake WebSocket reconnect adopts G2 %s state",
    async (kind, processChange, g2Status) => {
      const reconciler = new BattleStateReconciler();
      class FakeBattleWebSocket {
        generation = 0;
        open() {
          this.generation = reconciler.beginConnection();
        }
        receiveSnapshot(snapshot: CommunityBattleStateV1) {
          return reconciler.apply(snapshot, this.generation, "snapshot");
        }
        close() {
          reconciler.invalidate();
        }
      }
      const g1 = new FakeBattleWebSocket();
      g1.open();
      expect(g1.receiveSnapshot(kind === "cancel" ? active() : ready())).toBe(true);
      const context = reconciler.captureMutationContext(kind)!;
      const delayedFetch = deferred<Response>();
      const fetcher = vi.fn(() => delayedFetch.promise);
      const pending = sendBattleMutation(
        fetcher as unknown as typeof fetch,
        reconciler,
        context,
        `/api/dev/battle/${kind}`,
        { method: "POST", body: JSON.stringify({ requestId: "same-request-id" }) },
      );
      expect(fetcher).toHaveBeenCalledOnce();

      g1.close();
      const g2 = new FakeBattleWebSocket();
      g2.open();
      const fresh =
        processChange === "same-process"
          ? kind === "start"
            ? ready()
            : active()
          : CommunityBattleStateV1Schema.parse({
              ...base,
              serverInstanceId: "new-process",
              serverStartedAt: "2026-10-30T00:00:00.000Z",
            });
      expect(g2.receiveSnapshot(fresh)).toBe(true);
      expect(reconciler.state?.status).toBe(g2Status);

      delayedFetch.resolve(
        new Response(JSON.stringify(kind === "start" ? active() : cancelled()), { status: 200 }),
      );
      expect(await pending).toEqual({ kind: "stale" });
      expect(reconciler.state?.status).toBe(g2Status);
    },
  );

  it("rejects a response after the same socket adopts a different encounter context", async () => {
    const reconciler = new BattleStateReconciler();
    const generation = reconciler.beginConnection();
    expect(reconciler.apply(ready(), generation, "snapshot")).toBe(true);
    const context = reconciler.captureMutationContext("start")!;
    const delayedFetch = deferred<Response>();
    const pending = sendBattleMutation(
      (() => delayedFetch.promise) as typeof fetch,
      reconciler,
      context,
      "/api/dev/battle/start",
      { method: "POST" },
    );
    const nextEncounter = CommunityBattleStateV1Schema.parse({
      ...ready(2, "enc-2"),
    });
    expect(reconciler.apply(nextEncounter, generation, "websocket")).toBe(true);
    delayedFetch.resolve(new Response(JSON.stringify(active()), { status: 200 }));
    expect(await pending).toEqual({ kind: "stale" });
    expect(reconciler.state?.encounterId).toBe("enc-2");
  });
});
