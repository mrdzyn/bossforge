import { z } from "zod";
export { ForgeStateReconciler } from "./forge-state-reconciler.js";

export const ProviderSchema = z.enum(["mock", "twitch"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const ViewerIdentitySchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(50),
});
export type ViewerIdentity = z.infer<typeof ViewerIdentitySchema>;

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

export const ChatMessageSchema = z.object({
  id: z.string().min(1).max(100),
  viewer: ViewerIdentitySchema,
  text: z.string().max(500),
  occurredAt: z.string().datetime(),
  command: VoteCommandSchema.optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const NormalizedChatEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("viewer.connected"),
    provider: ProviderSchema,
    viewer: ViewerIdentitySchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("chat.message"),
    provider: ProviderSchema,
    message: ChatMessageSchema,
  }),
  z.object({
    kind: z.literal("viewer.disconnected"),
    provider: ProviderSchema,
    viewer: ViewerIdentitySchema,
    occurredAt: z.string().datetime(),
  }),
]);
export type NormalizedChatEvent = z.infer<typeof NormalizedChatEventSchema>;

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

export const ForgeStateSchema = z.object({
  serverInstanceId: z.string().min(1).max(100),
  serverStartedAt: z.string().datetime(),
  revision: z.number().int().min(0),
  cycleId: z.string().min(1).max(100).nullable(),
  status: z.enum(["idle", "voting", "revealed"]),
  simulated: z.literal(true),
  connectedToTwitch: z.literal(false),
  durationSeconds: z.number().int().min(5).max(60),
  startedAt: z.string().datetime().nullable(),
  activeCategory: VoteCategorySchema.nullable(),
  progress: z.number().int().min(0).max(4),
  categories: z.array(ForgeCategoryStateSchema).length(4),
  boss: BossSchema.nullable(),
});
export type ForgeState = z.infer<typeof ForgeStateSchema>;

export const ForgeStateEventSchema = z.object({
  kind: z.literal("forge.state"),
  source: z.literal("mock"),
  state: ForgeStateSchema,
});
export type ForgeStateEvent = z.infer<typeof ForgeStateEventSchema>;

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

export const ConnectionStatusSchema = z.object({
  kind: z.literal("connection.status"),
  source: ProviderSchema,
  status: z.enum(["connecting", "connected", "disconnected", "error"]),
});
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const AppEventPayloadSchema = z.union([
  NormalizedChatEventSchema,
  ConnectionStatusSchema,
  ForgeStateEventSchema,
]);
export type AppEventPayload = z.infer<typeof AppEventPayloadSchema>;

export const AppEventEnvelopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.event"),
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    payload: NormalizedChatEventSchema,
  }),
  z.object({
    type: z.literal("connection.status"),
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    payload: ConnectionStatusSchema,
  }),
  z.object({
    type: z.literal("forge.state"),
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    payload: ForgeStateEventSchema,
  }),
]);
export type AppEventEnvelope = z.infer<typeof AppEventEnvelopeSchema>;

export function createEventEnvelope(
  payload: AppEventPayload,
  id: string,
  timestamp: string,
): AppEventEnvelope {
  const type =
    payload.kind === "connection.status"
      ? "connection.status"
      : payload.kind === "forge.state"
        ? "forge.state"
        : "chat.event";
  return AppEventEnvelopeSchema.parse({ type, schemaVersion: 1, id, timestamp, payload });
}
