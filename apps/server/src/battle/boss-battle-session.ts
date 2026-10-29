import { randomUUID } from "node:crypto";
import {
  CommunityBattleStateV1Schema,
  GENERIC_PROFILE_V1,
  authoritativeCompletedReveal,
  type BattleCancelRequest,
  type BattleStartRequest,
  type CommunityBattleStateV1,
  type ForgeState,
} from "@bossforge/shared";

export interface BattleScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}
const realScheduler: BattleScheduler = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};
export type BattleCancelReason = CommunityBattleStateV1["cancelReason"];
type Result =
  | { ok: true; state: CommunityBattleStateV1 }
  | {
      ok: false;
      error:
        | "battle_not_ready"
        | "revision_conflict"
        | "encounter_active"
        | "provider_unverified"
        | "idempotency_conflict";
    };
type CacheEntry = { fingerprint: string; result: Result };

export class BossBattleSession {
  private revision = 0;
  private state: CommunityBattleStateV1;
  private readonly seenForgeIdentities = new Set<string>();
  private cancelTimer: (() => void) | undefined;
  private monotonicDeadline: number | null = null;
  private readonly idempotency = new Map<string, CacheEntry>();
  private readonly monotonicNow: () => number;
  private readonly wallNow: () => Date;

  constructor(
    private readonly serverInstanceId: string,
    private readonly serverStartedAt: string,
    private readonly scheduler: BattleScheduler = realScheduler,
    monotonicNow: () => number = () => performance.now(),
    wallNow: () => Date = () => new Date(),
    private readonly makeId: () => string = randomUUID,
    private readonly onChange: (state: CommunityBattleStateV1) => void = () => undefined,
  ) {
    this.monotonicNow = monotonicNow;
    this.wallNow = wallNow;
    this.state = this.buildIdle();
  }
  getState(): CommunityBattleStateV1 {
    this.resolveDeadline();
    return structuredClone(this.state);
  }

  /** Returns the active snapshot for an ingress receipt made before its deadline. */
  getStateForReceipt(receiptMonotonicMs: number): CommunityBattleStateV1 {
    if (
      this.state.status === "active" &&
      this.monotonicDeadline !== null &&
      Number.isFinite(receiptMonotonicMs) &&
      receiptMonotonicMs < this.monotonicDeadline
    )
      return structuredClone(this.state);
    return this.getState();
  }

  onForgeState(forge: ForgeState): CommunityBattleStateV1 {
    this.resolveDeadline();
    const completedForge = authoritativeCompletedReveal(forge);
    if (completedForge) {
      const forgeIdentity = {
        serverInstanceId: completedForge.serverInstanceId,
        serverStartedAt: completedForge.serverStartedAt,
        cycleId: completedForge.cycleId,
        mode: completedForge.mode,
      };
      const identityKey = JSON.stringify(forgeIdentity);
      if (this.seenForgeIdentities.has(identityKey)) return this.state;
      if (this.state.status === "active" || this.state.status === "ready")
        this.cancel("forge_reset");
      if (["victory", "expired", "cancelled"].includes(this.state.status)) this.toIdle();
      this.seenForgeIdentities.add(identityKey);
      if (this.seenForgeIdentities.size > 256)
        this.seenForgeIdentities.delete(this.seenForgeIdentities.values().next().value!);
      return this.commit({
        ...this.buildIdle(),
        status: "ready",
        forgeIdentity,
        encounterId: this.makeId(),
        forgeCycleId: completedForge.cycleId,
        bossSnapshot: {
          id: completedForge.boss.id,
          name: completedForge.boss.name,
          attributes: { ...completedForge.boss.attributes },
        },
        profileId: "generic",
        profileVersion: 1,
        profileSnapshot: structuredClone(GENERIC_PROFILE_V1),
      });
    }
    const currentForgeIdentity = this.state.forgeIdentity;
    if (
      currentForgeIdentity &&
      (forge.serverInstanceId !== currentForgeIdentity.serverInstanceId ||
        forge.serverStartedAt !== currentForgeIdentity.serverStartedAt ||
        forge.cycleId !== currentForgeIdentity.cycleId ||
        forge.mode !== currentForgeIdentity.mode) &&
      (this.state.status === "ready" || this.state.status === "active")
    )
      return this.cancel("forge_reset");
    if (
      forge.status === "idle" &&
      (this.state.status === "ready" || this.state.status === "active")
    )
      return this.cancel("forge_reset");
    return this.state;
  }

  onOwnerForgeReset(): void {
    this.resolveDeadline();
    if (this.state.status === "ready" || this.state.status === "active") this.cancel("forge_reset");
    else if (["victory", "expired", "cancelled"].includes(this.state.status)) this.toIdle();
  }

  start(request: BattleStartRequest, providerReady: boolean): Result {
    this.resolveDeadline();
    const fingerprint = JSON.stringify(request);
    const cached = this.idempotency.get(request.requestId);
    if (cached)
      return cached.fingerprint === fingerprint
        ? cached.result
        : { ok: false, error: "idempotency_conflict" };
    let result: Result;
    if (!providerReady) result = { ok: false, error: "provider_unverified" };
    else if (this.state.status !== "ready")
      result = {
        ok: false,
        error: this.state.status === "active" ? "encounter_active" : "battle_not_ready",
      };
    else if (
      request.expectedRevision !== this.state.revision ||
      request.forgeCycleId !== this.state.forgeCycleId ||
      JSON.stringify(request.forgeIdentity) !== JSON.stringify(this.state.forgeIdentity)
    )
      result = { ok: false, error: "revision_conflict" };
    else {
      const duration = request.durationSeconds;
      const hp =
        GENERIC_PROFILE_V1.encounter.audienceHpByDuration[String(duration) as "60" | "90" | "120"][
          request.audienceBand
        ];
      const started = this.wallNow();
      const monoDeadline = this.monotonicNow() + duration * 1000;
      const startedAt = started.toISOString();
      const deadlineAt = new Date(started.getTime() + duration * 1000).toISOString();
      const next = this.commit({
        ...this.state,
        status: "active",
        audienceBand: request.audienceBand,
        durationSeconds: duration,
        startedAt,
        deadlineAt,
        currentHp: hp,
        maxHp: hp,
      });
      this.monotonicDeadline = monoDeadline;
      this.scheduleExpiry(monoDeadline, next.encounterId!);
      result = { ok: true, state: next };
    }
    this.remember(request.requestId, fingerprint, result);
    return result;
  }

  cancelRequest(request: BattleCancelRequest): Result {
    this.resolveDeadline();
    const fingerprint = JSON.stringify(request);
    const cached = this.idempotency.get(request.requestId);
    if (cached)
      return cached.fingerprint === fingerprint
        ? cached.result
        : { ok: false, error: "idempotency_conflict" };
    let result: Result;
    if (
      request.expectedRevision !== this.state.revision ||
      request.encounterId !== this.state.encounterId
    )
      result = { ok: false, error: "revision_conflict" };
    else if (this.state.status !== "ready" && this.state.status !== "active")
      result = { ok: false, error: "battle_not_ready" };
    else result = { ok: true, state: this.cancel("owner_cancelled") };
    this.remember(request.requestId, fingerprint, result);
    return result;
  }

  cancel(reason: Exclude<BattleCancelReason, null>): CommunityBattleStateV1 {
    this.resolveDeadline();
    if (this.state.status !== "ready" && this.state.status !== "active") return this.state;
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    this.monotonicDeadline = null;
    return this.commit({ ...this.state, status: "cancelled", cancelReason: reason });
  }

  setProviderReady(
    ready: boolean,
    reason: "twitch_disconnected" | "twitch_session_invalidated" = "twitch_disconnected",
  ): void {
    if (!ready) this.cancel(reason);
  }

  /** Private server combat transition. Only BattleAttackRouter calls this in production. */
  applyAcceptedDamage(
    amount: number,
    weakness: boolean,
    expectedEncounterId: string,
    receiptMonotonicMs: number,
  ): CommunityBattleStateV1 | null {
    if (
      this.state.status !== "active" ||
      this.state.encounterId !== expectedEncounterId ||
      this.monotonicDeadline === null ||
      !Number.isFinite(receiptMonotonicMs) ||
      receiptMonotonicMs >= this.monotonicDeadline ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      this.resolveDeadline();
      return null;
    }
    const damage = Math.min(amount, this.state.currentHp!);
    const hp = this.state.currentHp! - damage;
    const deadlineReached = this.monotonicNow() >= this.monotonicDeadline;
    const terminal = hp === 0 || deadlineReached;
    const next = this.commit({
      ...this.state,
      currentHp: hp,
      damageApplied: this.state.damageApplied + damage,
      acceptedHitCount: this.state.acceptedHitCount + 1,
      baseHitCount: this.state.baseHitCount + (weakness ? 0 : 1),
      weaknessHitCount: this.state.weaknessHitCount + (weakness ? 1 : 0),
      status: hp === 0 ? "victory" : deadlineReached ? "expired" : "active",
    });
    if (terminal) {
      this.cancelTimer?.();
      this.cancelTimer = undefined;
      this.monotonicDeadline = null;
    }
    return next;
  }

  close(): void {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    if (this.state.status === "active" || this.state.status === "ready")
      this.cancel("server_shutdown");
  }
  private resolveDeadline(): void {
    if (
      this.state.status === "active" &&
      this.monotonicDeadline !== null &&
      this.monotonicNow() >= this.monotonicDeadline
    )
      this.expire(this.state.encounterId!);
  }
  private scheduleExpiry(deadline: number, encounter: string): void {
    this.cancelTimer?.();
    this.cancelTimer = this.scheduler.schedule(
      () => {
        if (this.state.encounterId !== encounter || this.state.status !== "active") return;
        const remaining = deadline - this.monotonicNow();
        if (remaining > 0) this.scheduleExpiry(deadline, encounter);
        else this.expire(encounter);
      },
      Math.max(0, deadline - this.monotonicNow()),
    );
  }
  private expire(encounter: string): void {
    if (this.state.status === "active" && this.state.encounterId === encounter) {
      this.cancelTimer?.();
      this.cancelTimer = undefined;
      this.monotonicDeadline = null;
      this.commit({ ...this.state, status: "expired" });
    }
  }
  private toIdle(): void {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    this.monotonicDeadline = null;
    this.commit(this.buildIdle());
  }
  private buildIdle(): CommunityBattleStateV1 {
    return CommunityBattleStateV1Schema.parse({
      schemaVersion: 1,
      serverInstanceId: this.serverInstanceId,
      serverStartedAt: this.serverStartedAt,
      revision: this.revision,
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
  }
  private commit(next: CommunityBattleStateV1): CommunityBattleStateV1 {
    this.revision += 1;
    this.state = CommunityBattleStateV1Schema.parse({ ...next, revision: this.revision });
    const projection = structuredClone(this.state);
    this.onChange(projection);
    return projection;
  }
  private remember(id: string, fingerprint: string, result: Result): void {
    this.idempotency.set(id, { fingerprint, result });
    if (this.idempotency.size > 256) this.idempotency.delete(this.idempotency.keys().next().value!);
  }
}
