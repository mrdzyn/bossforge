import { createHmac, randomBytes } from "node:crypto";
import { GENERIC_PROFILE_V1 } from "@bossforge/shared";
import type { CommunityBattleStateV1, ForgeAuthorityIdentity } from "@bossforge/shared";
import type { NormalizedChatEvent } from "../events/normalized-chat-event.js";
import { parseHitCommand } from "./hit-command.js";
import type { BossBattleSession } from "./boss-battle-session.js";

export type AttackRejectCode =
  | "invalid"
  | "duplicate"
  | "inactive"
  | "wrong_provider"
  | "cooldown"
  | "rate_limited"
  | "queue_full"
  | "queue_expired"
  | "replay_capacity"
  | "busy"
  | "late";

export interface BattleAttackMetrics {
  attempted: number;
  accepted: number;
  rejected: number;
  base: number;
  weakness: number;
  weaknessMismatch: number;
  reasons: Record<AttackRejectCode, number>;
}

export interface AttackSource {
  provider: "mock" | "twitch";
  generation: number;
  verified: boolean;
}

export interface BattleAttackRouterOptions {
  battle: BossBattleSession;
  getProvider(): "mock" | "twitch";
  getGeneration(): number;
  getForgeIdentity(): ForgeAuthorityIdentity | null;
  isTwitchVerified(): boolean;
  monotonicNow?: () => number;
  hmacKey?: Buffer;
  onMetrics?: (metrics: BattleAttackMetrics) => void;
}

const rejectCodes: readonly AttackRejectCode[] = [
  "invalid",
  "duplicate",
  "inactive",
  "wrong_provider",
  "cooldown",
  "rate_limited",
  "queue_full",
  "queue_expired",
  "replay_capacity",
  "busy",
  "late",
];
const bounded = (value: number) => Math.min(10_000, value + 1);
type Bucket = { tokens: number; at: number };

/** Private trusted-ingress path; no browser route or public projection can call its damage processor. */
export class BattleAttackRouter {
  private readonly now: () => number;
  private readonly hmacKey: Buffer;
  private readonly replay = new Map<string, number>();
  private readonly cooldowns = new Map<string, number>();
  private readonly ingress = new Map<string, Bucket>();
  private acceptedHits: Bucket = { tokens: GENERIC_PROFILE_V1.limits.acceptedHitsBurst, at: 0 };
  private queue: Array<{
    receipt: number;
    sequence: number;
    state: CommunityBattleStateV1;
    viewerKey: string;
    element: string | null;
  }> = [];
  private draining = false;
  private sequence = 0;
  private metrics: BattleAttackMetrics = this.emptyMetrics();
  private publishTimer: ReturnType<typeof setTimeout> | undefined;
  private encounterId: string | null = null;

  constructor(private readonly options: BattleAttackRouterOptions) {
    this.now = options.monotonicNow ?? (() => performance.now());
    this.hmacKey = options.hmacKey ?? randomBytes(32);
  }

  snapshot(): BattleAttackMetrics {
    return structuredClone(this.metrics);
  }

  onBattleState(state: CommunityBattleStateV1): void {
    if (state.encounterId !== this.encounterId) {
      this.queue = [];
      this.cooldowns.clear();
      this.encounterId = state.encounterId;
      this.metrics = this.emptyMetrics();
    }
    if (state.status !== "active") {
      this.queue = [];
      this.cooldowns.clear();
    }
    if (state.status === "idle") this.metrics = this.emptyMetrics();
  }

  handle(event: NormalizedChatEvent, source: AttackSource): void {
    if (event.kind !== "chat.message") return;
    const receipt = this.now();
    const withinIngressLimit = this.take(
      this.ingress,
      source.provider,
      receipt,
      GENERIC_PROFILE_V1.limits.chatIngressPerSecond,
      GENERIC_PROFILE_V1.limits.chatIngressBurst,
    );
    if (!event.message.text.startsWith("!hit")) return;
    this.metrics.attempted = bounded(this.metrics.attempted);
    if (event.provider !== source.provider || source.provider !== this.options.getProvider())
      return this.reject("wrong_provider");
    if (source.generation !== this.options.getGeneration()) return this.reject("wrong_provider");
    if (source.provider === "twitch" && (!source.verified || !this.options.isTwitchVerified()))
      return this.reject("inactive");

    const command = parseHitCommand(event.message.text);
    if (
      !command ||
      !event.message.id ||
      event.message.id.length > 100 ||
      !/^[\p{L}\p{N}_-]{1,64}$/u.test(event.message.viewer.id)
    )
      return this.reject("invalid");
    this.expireReplay(receipt);
    const replayKey = `${source.provider}:${event.message.id}`;
    if (this.replay.has(replayKey)) return this.reject("duplicate");
    if (this.replay.size >= GENERIC_PROFILE_V1.limits.maxDedupeEntries)
      return this.reject("replay_capacity");
    // Reserve every valid candidate ID before battle/cooldown/queue decisions.
    this.replay.set(replayKey, receipt + GENERIC_PROFILE_V1.limits.dedupeTtlMs);
    if (!withinIngressLimit) return this.reject("rate_limited");
    const state = this.options.battle.getStateForReceipt(receipt);
    const identity = this.options.getForgeIdentity();
    if (state.status === "expired" && state.encounterId) return this.reject("late");
    if (
      state.status !== "active" ||
      !state.encounterId ||
      !state.forgeIdentity ||
      !identity ||
      JSON.stringify(state.forgeIdentity) !== JSON.stringify(identity)
    )
      return this.reject("inactive");
    if (source.provider === "mock" && identity.mode !== "mock")
      return this.reject("wrong_provider");
    if (source.provider === "twitch" && identity.mode !== "twitch")
      return this.reject("wrong_provider");

    this.expireCooldowns(receipt);
    const viewerKey = this.pseudonym(source.provider, event.message.viewer.id);
    if (
      !this.cooldowns.has(viewerKey) &&
      this.cooldowns.size >= GENERIC_PROFILE_V1.limits.maxTrackedViewers
    )
      return this.reject("busy");
    if ((this.cooldowns.get(viewerKey) ?? -Infinity) > receipt) return this.reject("cooldown");
    if (this.queue.length >= GENERIC_PROFILE_V1.limits.queueCapacity)
      return this.reject("queue_full");
    const entry = {
      receipt,
      sequence: ++this.sequence,
      state,
      viewerKey,
      element: command.element,
    };
    this.queue.push(entry);
    this.queue.sort((a, b) => a.receipt - b.receipt || a.sequence - b.sequence);
    this.drain();
  }

  close(): void {
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.publishTimer = undefined;
    this.queue = [];
    this.cooldowns.clear();
    this.ingress.clear();
  }

  private process(entry: {
    receipt: number;
    sequence: number;
    state: CommunityBattleStateV1;
    viewerKey: string;
    element: string | null;
  }): void {
    const now = this.now();
    if (now - entry.receipt > GENERIC_PROFILE_V1.limits.maxQueueAgeMs)
      return this.reject("queue_expired");
    if (
      this.options.getProvider() !== entry.state.forgeIdentity?.mode ||
      JSON.stringify(this.options.getForgeIdentity()) !==
        JSON.stringify(entry.state.forgeIdentity) ||
      this.options.battle.getStateForReceipt(entry.receipt).encounterId !== entry.state.encounterId
    )
      return this.reject("inactive");
    if (entry.state.status !== "active") return this.reject("inactive");
    const profile = entry.state.profileSnapshot;
    if (!profile) return this.reject("inactive");
    const deadlineAt = entry.state.deadlineAt ? Date.parse(entry.state.deadlineAt) : 0;
    // Session applies receipt-time ordering against its monotonic deadline.
    if (
      !this.takeAccepted(
        now,
        profile.limits.acceptedHitsPerSecond,
        profile.limits.acceptedHitsBurst,
      )
    )
      return this.reject("rate_limited");
    const weakness = entry.element === entry.state.bossSnapshot?.attributes.weakness;
    const amount = weakness ? profile.encounter.weaknessDamage : profile.encounter.baseDamage;
    const result = this.options.battle.applyAcceptedDamage(
      amount,
      weakness,
      entry.state.encounterId!,
      entry.receipt,
    );
    if (result === null) return this.reject(now >= deadlineAt ? "late" : "inactive");
    if (result.status === "active")
      this.cooldowns.set(entry.viewerKey, now + profile.encounter.perViewerCooldownMs);
    this.metrics.accepted = bounded(this.metrics.accepted);
    if (weakness) this.metrics.weakness = bounded(this.metrics.weakness);
    else this.metrics.base = bounded(this.metrics.base);
    if (entry.element && !weakness)
      this.metrics.weaknessMismatch = bounded(this.metrics.weaknessMismatch);
    this.schedulePublish();
  }

  private drain(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) this.process(this.queue.shift()!);
    } finally {
      this.draining = false;
    }
  }

  private takeAccepted(now: number, rate: number, capacity: number): boolean {
    const elapsed = Math.max(0, now - this.acceptedHits.at);
    this.acceptedHits.tokens = Math.min(
      capacity,
      this.acceptedHits.tokens + (elapsed * rate) / 1000,
    );
    this.acceptedHits.at = now;
    if (this.acceptedHits.tokens < 1) return false;
    this.acceptedHits.tokens -= 1;
    return true;
  }

  private take(
    map: Map<string, Bucket>,
    key: string,
    now: number,
    rate: number,
    capacity: number,
  ): boolean {
    const bucket = map.get(key) ?? { tokens: capacity, at: now };
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + (Math.max(0, now - bucket.at) * rate) / 1000,
    );
    bucket.at = now;
    if (bucket.tokens < 1) {
      map.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    map.set(key, bucket);
    return true;
  }

  private expireReplay(now: number): void {
    for (const [id, expires] of this.replay) if (expires <= now) this.replay.delete(id);
  }

  private expireCooldowns(now: number): void {
    for (const [id, expiry] of this.cooldowns) if (expiry <= now) this.cooldowns.delete(id);
  }

  private pseudonym(provider: string, viewerId: string): string {
    return createHmac("sha256", this.hmacKey).update(`${provider}\0${viewerId}`).digest("hex");
  }

  private reject(code: AttackRejectCode): void {
    this.metrics.rejected = bounded(this.metrics.rejected);
    this.metrics.reasons[code] = bounded(this.metrics.reasons[code]);
    this.schedulePublish();
  }

  private schedulePublish(): void {
    if (this.publishTimer) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = undefined;
      this.options.onMetrics?.(this.snapshot());
    }, 300);
  }

  private emptyMetrics(): BattleAttackMetrics {
    return {
      attempted: 0,
      accepted: 0,
      rejected: 0,
      base: 0,
      weakness: 0,
      weaknessMismatch: 0,
      reasons: Object.fromEntries(rejectCodes.map((code) => [code, 0])) as Record<
        AttackRejectCode,
        number
      >,
    };
  }
}
