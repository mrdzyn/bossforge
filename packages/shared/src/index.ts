import { z } from "zod";
export { ForgeStateReconciler } from "./forge-state-reconciler.js";
export * from "./combat.js";
export * from "./voting-presentation.js";

export const ProviderSchema = z.enum(["mock", "twitch"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const VoteCategorySchema = z.enum(["body", "element", "special", "weakness"]);
export type VoteCategory = z.infer<typeof VoteCategorySchema>;

export const VoteCommandSchema = z.object({
  category: VoteCategorySchema,
  choice: z.string().trim().min(1).max(40),
});
export type VoteCommand = z.infer<typeof VoteCommandSchema>;

export function parseVoteCommand(text: string): VoteCommand | undefined {
  const match = /^!vote\s+(body|element|special|weakness)\s+([\p{L}\p{N}_-]{1,40})\s*$/iu.exec(
    text.trim(),
  );
  if (!match?.[1] || !match[2]) return undefined;
  return VoteCommandSchema.parse({ category: match[1].toLowerCase(), choice: match[2] });
}

export const VoteSessionConfigSchema = z.object({
  id: z.string().min(1).max(100),
  category: VoteCategorySchema,
  choices: z.array(z.string().trim().min(1).max(40)).min(2).max(12),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
});
export type VoteSessionConfig = z.infer<typeof VoteSessionConfigSchema>;

export const BossAttributesSchema = z.object({
  body: z.enum(["golem", "wraith", "drake", "mimic"]),
  element: z.enum(["fire", "ice", "storm", "void"]),
  special: z.enum(["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"]),
  weakness: z.enum(["water", "light", "earth", "wind"]),
});
export type BossAttributes = z.infer<typeof BossAttributesSchema>;

export const BossStatsSchema = z.object({
  health: z.number().int().min(1).max(100_000),
  damage: z.number().int().min(1).max(1_000),
  attackIntervalMs: z.number().int().min(100).max(60_000),
});
export type BossStats = z.infer<typeof BossStatsSchema>;

export const BossSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  attributes: BossAttributesSchema,
  stats: BossStatsSchema,
});
export type Boss = z.infer<typeof BossSchema>;

export const FORGE_VOTE_CHOICES = {
  body: ["golem", "wraith", "drake", "mimic"],
  element: ["fire", "ice", "storm", "void"],
  special: ["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"],
  weakness: ["water", "light", "earth", "wind"],
} as const satisfies Record<VoteCategory, readonly string[]>;

export const ForgeStartRequestSchema = z
  .object({ durationSeconds: z.number().int().min(5).max(60).optional() })
  .strict();
export type ForgeStartRequest = z.infer<typeof ForgeStartRequestSchema>;

export const ForgeOptionResultSchema = z.object({
  choice: z.string().min(1).max(40),
  count: z.number().int().min(0).max(10_000),
  percentage: z.number().int().min(0).max(100),
});
export type ForgeOptionResult = z.infer<typeof ForgeOptionResultSchema>;

export const ForgeCategoryStateSchema = z.object({
  category: VoteCategorySchema,
  status: z.enum(["pending", "open", "closed"]),
  options: z.array(ForgeOptionResultSchema).min(2).max(12),
  totalVotes: z.number().int().min(0).max(10_000),
  openedAt: z.string().datetime().nullable(),
  closesAt: z.string().datetime().nullable(),
  winner: z.string().min(1).max(40).nullable(),
  noVoteFallback: z.boolean(),
});
export type ForgeCategoryState = z.infer<typeof ForgeCategoryStateSchema>;

const ForgeStateBaseSchema = z.object({
  serverInstanceId: z.string().min(1).max(100),
  serverStartedAt: z.string().datetime(),
  revision: z.number().int().min(0),
  cycleId: z.string().min(1).max(100).nullable(),
  status: z.enum(["idle", "voting", "revealed"]),
  mode: ProviderSchema,
  simulated: z.boolean(),
  connectedToTwitch: z.boolean(),
  durationSeconds: z.number().int().min(5).max(60),
  startedAt: z.string().datetime().nullable(),
  activeCategory: VoteCategorySchema.nullable(),
  progress: z.number().int().min(0).max(4),
  categories: z.array(ForgeCategoryStateSchema).length(4),
  boss: BossSchema.nullable(),
});

function refineForgeMode(
  state: z.infer<typeof ForgeStateBaseSchema>,
  context: z.RefinementCtx,
): void {
  if (state.simulated !== (state.mode === "mock"))
    context.addIssue({ code: "custom", message: "Simulation label must match forge mode" });
  if (state.connectedToTwitch && state.mode !== "twitch")
    context.addIssue({ code: "custom", message: "Twitch connection requires Twitch mode" });
}

export const ForgeStateSchema = ForgeStateBaseSchema.superRefine(refineForgeMode);
export type ForgeState = z.infer<typeof ForgeStateSchema>;

export const RevealedForgeStateSchema = ForgeStateBaseSchema.extend({
  cycleId: z.string().min(1).max(100),
  status: z.literal("revealed"),
  activeCategory: z.null(),
  progress: z.literal(4),
  boss: BossSchema,
}).superRefine(refineForgeMode);
export type RevealedForgeState = z.infer<typeof RevealedForgeStateSchema>;

export const BattlePlayerSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().min(1).max(50),
  health: z.number().int().min(0).max(100_000),
});

export const BattleStateSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(["lobby", "voting", "active", "streamer-won", "community-won"]),
  players: z.array(BattlePlayerSchema).max(100),
  boss: BossSchema,
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type BattleState = z.infer<typeof BattleStateSchema>;

// Public wire contracts are deliberately separate from NormalizedChatEvent and
// use strict objects at every level. Internal chat identities/text must never
// become valid public payloads.
const PublicBossAttributesSchema = z
  .object({
    body: BossAttributesSchema.shape.body,
    element: BossAttributesSchema.shape.element,
    special: BossAttributesSchema.shape.special,
    weakness: BossAttributesSchema.shape.weakness,
  })
  .strict();
const PublicBossSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(60),
    attributes: PublicBossAttributesSchema,
    stats: z
      .object({
        health: z.number().int().min(1).max(100_000),
        damage: z.number().int().min(1).max(1_000),
        attackIntervalMs: z.number().int().min(100).max(60_000),
      })
      .strict(),
  })
  .strict();
const PublicForgeOptionSchema = z
  .object({
    choice: z.string().min(1).max(40),
    count: z.number().int().min(0).max(10_000),
    percentage: z.number().int().min(0).max(100),
  })
  .strict();
const PublicForgeCategorySchema = z
  .object({
    category: VoteCategorySchema,
    status: z.enum(["pending", "open", "closed"]),
    options: z.array(PublicForgeOptionSchema).min(2).max(12),
    totalVotes: z.number().int().min(0).max(10_000),
    openedAt: z.string().datetime().nullable(),
    closesAt: z.string().datetime().nullable(),
    winner: z.string().min(1).max(40).nullable(),
    noVoteFallback: z.boolean(),
  })
  .strict();
export const PublicForgeStateSchema = z
  .object({
    serverInstanceId: z.string().min(1).max(100),
    serverStartedAt: z.string().datetime(),
    revision: z.number().int().min(0),
    cycleId: z.string().min(1).max(100).nullable(),
    status: z.enum(["idle", "voting", "revealed"]),
    mode: ProviderSchema,
    simulated: z.boolean(),
    connectedToTwitch: z.boolean(),
    durationSeconds: z.number().int().min(5).max(60),
    startedAt: z.string().datetime().nullable(),
    activeCategory: VoteCategorySchema.nullable(),
    progress: z.number().int().min(0).max(4),
    categories: z.array(PublicForgeCategorySchema).length(4),
    boss: PublicBossSchema.nullable(),
  })
  .strict()
  .superRefine(refineForgeMode);
export type PublicForgeState = z.infer<typeof PublicForgeStateSchema>;

const PublicConnectionStatusSchema = z
  .object({
    kind: z.literal("connection.status"),
    source: ProviderSchema,
    status: z.enum(["connecting", "connected", "disconnected", "error"]),
  })
  .strict();
const PublicForgeStateEventSchema = z
  .object({
    kind: z.literal("forge.state"),
    source: ProviderSchema,
    state: PublicForgeStateSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.source !== event.state.mode)
      context.addIssue({ code: "custom", message: "Forge event source must match forge mode" });
  });
export const DashboardActivitySchema = z
  .object({
    accepted: z.number().int().min(0).max(10_000),
    rejected: z.number().int().min(0).max(10_000),
    reasons: z
      .object({
        invalid: z.number().int().min(0).max(10_000),
        duplicate: z.number().int().min(0).max(10_000),
        inactive: z.number().int().min(0).max(10_000),
        other: z.number().int().min(0).max(10_000),
      })
      .strict(),
  })
  .strict();
export type DashboardActivity = z.infer<typeof DashboardActivitySchema>;
const PublicEnvelopeBase = {
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
} as const;
const DashboardForgeEnvelope = z
  .object({
    ...PublicEnvelopeBase,
    type: z.literal("forge.state"),
    payload: PublicForgeStateEventSchema,
  })
  .strict();
const DashboardConnectionEnvelope = z
  .object({
    ...PublicEnvelopeBase,
    type: z.literal("connection.status"),
    payload: PublicConnectionStatusSchema,
  })
  .strict();
const DashboardActivityEnvelope = z
  .object({
    ...PublicEnvelopeBase,
    type: z.literal("dashboard.activity"),
    payload: DashboardActivitySchema,
  })
  .strict();
export const DashboardEventEnvelopeSchema = z.discriminatedUnion("type", [
  DashboardForgeEnvelope,
  DashboardConnectionEnvelope,
  DashboardActivityEnvelope,
]);
export type DashboardEventEnvelope = z.infer<typeof DashboardEventEnvelopeSchema>;
export const OverlayEventEnvelopeSchema = z.discriminatedUnion("type", [
  DashboardForgeEnvelope,
  DashboardConnectionEnvelope,
]);
export type OverlayEventEnvelope = z.infer<typeof OverlayEventEnvelopeSchema>;
