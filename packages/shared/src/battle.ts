import { z } from "zod";

export const AudienceBandSchema = z.enum(["low", "medium", "high"]);
export type AudienceBand = z.infer<typeof AudienceBandSchema>;
export const BattleStatusSchema = z.enum([
  "idle",
  "ready",
  "active",
  "victory",
  "expired",
  "cancelled",
]);
export const BattleCancelReasonSchema = z.enum([
  "owner_cancelled",
  "forge_reset",
  "provider_changed",
  "twitch_disconnected",
  "twitch_session_invalidated",
  "server_shutdown",
]);
const isoDate = z.string().datetime();
const bossSnapshotSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(60),
    attributes: z
      .object({
        body: z.enum(["golem", "wraith", "drake", "mimic"]),
        element: z.enum(["fire", "ice", "storm", "void"]),
        special: z.enum(["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"]),
        weakness: z.enum(["water", "light", "earth", "wind"]),
      })
      .strict(),
  })
  .strict();

export const GenericProfileV1Schema = z
  .object({
    profileId: z.literal("generic"),
    version: z.literal(1),
    display: z
      .object({ themeId: z.literal("generic-default"), label: z.literal("Generic") })
      .strict(),
    encounter: z
      .object({
        minDurationSeconds: z.literal(60),
        defaultDurationSeconds: z.literal(90),
        maxDurationSeconds: z.literal(120),
        audienceHpByDuration: z
          .object({
            "60": z
              .object({ low: z.literal(100), medium: z.literal(400), high: z.literal(1000) })
              .strict(),
            "90": z
              .object({ low: z.literal(150), medium: z.literal(550), high: z.literal(1500) })
              .strict(),
            "120": z
              .object({ low: z.literal(200), medium: z.literal(750), high: z.literal(2000) })
              .strict(),
          })
          .strict(),
        baseDamage: z.literal(8),
        weaknessDamage: z.literal(14),
        perViewerCooldownMs: z.literal(2000),
      })
      .strict(),
    limits: z
      .object({
        chatIngressPerSecond: z.literal(50),
        chatIngressBurst: z.literal(100),
        acceptedHitsPerSecond: z.literal(8),
        acceptedHitsBurst: z.literal(16),
        queueCapacity: z.literal(64),
        maxQueueAgeMs: z.literal(500),
        dedupeTtlMs: z.literal(600000),
        maxDedupeEntries: z.literal(10000),
        maxTrackedViewers: z.literal(5000),
      })
      .strict(),
    challengeIds: z.array(z.never()).max(0),
  })
  .strict();
export type GenericProfileV1 = z.infer<typeof GenericProfileV1Schema>;
export const GENERIC_PROFILE_V1: GenericProfileV1 = GenericProfileV1Schema.parse({
  profileId: "generic",
  version: 1,
  display: { themeId: "generic-default", label: "Generic" },
  encounter: {
    minDurationSeconds: 60,
    defaultDurationSeconds: 90,
    maxDurationSeconds: 120,
    audienceHpByDuration: {
      "60": { low: 100, medium: 400, high: 1000 },
      "90": { low: 150, medium: 550, high: 1500 },
      "120": { low: 200, medium: 750, high: 2000 },
    },
    baseDamage: 8,
    weaknessDamage: 14,
    perViewerCooldownMs: 2000,
  },
  limits: {
    chatIngressPerSecond: 50,
    chatIngressBurst: 100,
    acceptedHitsPerSecond: 8,
    acceptedHitsBurst: 16,
    queueCapacity: 64,
    maxQueueAgeMs: 500,
    dedupeTtlMs: 600000,
    maxDedupeEntries: 10000,
    maxTrackedViewers: 5000,
  },
  challengeIds: [],
});

const battleBase = z
  .object({
    schemaVersion: z.literal(1),
    serverInstanceId: z.string().min(1).max(100),
    serverStartedAt: isoDate,
    revision: z.number().int().nonnegative(),
    status: BattleStatusSchema,
    encounterId: z.string().min(1).max(100).nullable(),
    forgeCycleId: z.string().min(1).max(100).nullable(),
    bossSnapshot: bossSnapshotSchema.nullable(),
    profileId: z.literal("generic").nullable(),
    profileVersion: z.literal(1).nullable(),
    profileSnapshot: GenericProfileV1Schema.nullable(),
    audienceBand: AudienceBandSchema.nullable(),
    durationSeconds: z.union([z.literal(60), z.literal(90), z.literal(120)]).nullable(),
    startedAt: isoDate.nullable(),
    deadlineAt: isoDate.nullable(),
    currentHp: z.number().int().min(0).max(2000).nullable(),
    maxHp: z.number().int().min(1).max(2000).nullable(),
    acceptedHitCount: z.number().int().min(0).max(100000),
    baseHitCount: z.number().int().min(0).max(100000),
    weaknessHitCount: z.number().int().min(0).max(100000),
    damageApplied: z.number().int().min(0).max(2000),
    cancelReason: BattleCancelReasonSchema.nullable(),
  })
  .strict();

export const CommunityBattleStateV1Schema = battleBase.superRefine((s, ctx) => {
  const activeIdentity =
    s.encounterId !== null &&
    s.forgeCycleId !== null &&
    s.bossSnapshot !== null &&
    s.profileSnapshot !== null &&
    s.profileId === "generic" &&
    s.profileVersion === 1;
  if (s.status === "idle") {
    if (
      s.encounterId !== null ||
      s.forgeCycleId !== null ||
      s.bossSnapshot !== null ||
      s.profileSnapshot !== null ||
      s.audienceBand !== null ||
      s.durationSeconds !== null ||
      s.startedAt !== null ||
      s.deadlineAt !== null ||
      s.currentHp !== null ||
      s.maxHp !== null ||
      s.cancelReason !== null ||
      s.acceptedHitCount !== 0 ||
      s.baseHitCount !== 0 ||
      s.weaknessHitCount !== 0 ||
      s.damageApplied !== 0
    )
      ctx.addIssue({ code: "custom", message: "Idle battle cannot hold an encounter" });
    if (s.profileId !== null || s.profileVersion !== null)
      ctx.addIssue({ code: "custom", message: "Idle battle cannot hold profile identity" });
    return;
  }
  if (!activeIdentity) ctx.addIssue({ code: "custom", message: "Encounter snapshot is required" });
  if (s.acceptedHitCount !== s.baseHitCount + s.weaknessHitCount)
    ctx.addIssue({ code: "custom", message: "Hit aggregate totals disagree" });
  if (s.status === "ready") {
    if (
      s.audienceBand !== null ||
      s.durationSeconds !== null ||
      s.startedAt !== null ||
      s.deadlineAt !== null ||
      s.currentHp !== null ||
      s.maxHp !== null ||
      s.cancelReason !== null ||
      s.acceptedHitCount !== 0 ||
      s.baseHitCount !== 0 ||
      s.weaknessHitCount !== 0 ||
      s.damageApplied !== 0
    )
      ctx.addIssue({ code: "custom", message: "Ready encounter must not be started" });
  } else if (s.status === "cancelled" && s.startedAt === null) {
    if (
      s.audienceBand !== null ||
      s.durationSeconds !== null ||
      s.deadlineAt !== null ||
      s.currentHp !== null ||
      s.maxHp !== null ||
      s.cancelReason === null ||
      s.acceptedHitCount !== 0 ||
      s.baseHitCount !== 0 ||
      s.weaknessHitCount !== 0 ||
      s.damageApplied !== 0
    )
      ctx.addIssue({ code: "custom", message: "Ready cancellation has no battle metrics" });
  } else {
    if (
      s.audienceBand === null ||
      s.durationSeconds === null ||
      s.startedAt === null ||
      s.deadlineAt === null ||
      s.currentHp === null ||
      s.maxHp === null
    )
      ctx.addIssue({ code: "custom", message: "Started encounter fields are required" });
    if (s.currentHp !== null && s.maxHp !== null && s.currentHp > s.maxHp)
      ctx.addIssue({ code: "custom", message: "Current HP exceeds maximum" });
    if (s.currentHp !== null && s.maxHp !== null && s.damageApplied !== s.maxHp - s.currentHp)
      ctx.addIssue({ code: "custom", message: "Applied damage must match HP delta" });
    if (
      s.startedAt !== null &&
      s.deadlineAt !== null &&
      s.durationSeconds !== null &&
      Date.parse(s.deadlineAt) - Date.parse(s.startedAt) !== s.durationSeconds * 1000
    )
      ctx.addIssue({ code: "custom", message: "Battle deadline must match locked duration" });
    if (
      s.maxHp !== null &&
      s.audienceBand !== null &&
      s.durationSeconds !== null &&
      s.profileSnapshot
    ) {
      const key = String(s.durationSeconds) as "60" | "90" | "120";
      if (s.maxHp !== s.profileSnapshot.encounter.audienceHpByDuration[key][s.audienceBand])
        ctx.addIssue({ code: "custom", message: "HP must match selected profile band" });
    }
    if (s.status === "active" && (s.currentHp === 0 || s.cancelReason !== null))
      ctx.addIssue({
        code: "custom",
        message: "Active encounter must have HP and no cancel reason",
      });
    if (s.status === "victory" && (s.currentHp !== 0 || s.cancelReason !== null))
      ctx.addIssue({ code: "custom", message: "Victory requires zero HP" });
    if (s.status === "expired" && (s.currentHp === 0 || s.cancelReason !== null))
      ctx.addIssue({ code: "custom", message: "Expired encounter must survive" });
    if (s.status === "cancelled" && s.cancelReason === null)
      ctx.addIssue({ code: "custom", message: "Cancellation reason required" });
  }
});
export type CommunityBattleStateV1 = z.infer<typeof CommunityBattleStateV1Schema>;

/** OBS gets only renderable battle fields; tuning/processing profile data stays dashboard/API-only. */
export const OverlayBattleStateV1Schema = battleBase
  .omit({
    profileId: true,
    profileVersion: true,
    profileSnapshot: true,
  })
  .strict();
export type OverlayBattleStateV1 = z.infer<typeof OverlayBattleStateV1Schema>;
export const OverlayBattleEventEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    timestamp: isoDate,
    type: z.literal("battle.state"),
    payload: z
      .object({ kind: z.literal("battle.state"), state: OverlayBattleStateV1Schema })
      .strict(),
  })
  .strict();

export const BattleStartRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    forgeCycleId: z.string().min(1).max(100),
    durationSeconds: z.union([z.literal(60), z.literal(90), z.literal(120)]),
    audienceBand: AudienceBandSchema,
  })
  .strict();
export const BattleCancelRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    encounterId: z.string().min(1).max(100),
  })
  .strict();
export type BattleStartRequest = z.infer<typeof BattleStartRequestSchema>;
export type BattleCancelRequest = z.infer<typeof BattleCancelRequestSchema>;
export const BattleEventEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    timestamp: isoDate,
    type: z.literal("battle.state"),
    payload: z
      .object({ kind: z.literal("battle.state"), state: CommunityBattleStateV1Schema })
      .strict(),
  })
  .strict();
export type BattleEventEnvelope = z.infer<typeof BattleEventEnvelopeSchema>;
