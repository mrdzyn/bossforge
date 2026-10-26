import {
  NormalizedChatEventSchema,
  parseVoteCommand,
  type NormalizedChatEvent,
} from "@bossforge/shared";
import { z } from "zod";

const RFC3339_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const TwitchTimestampSchema = z.string().regex(RFC3339_TIMESTAMP);
const UserIdSchema = z.string().regex(/^\d{1,32}$/u);

const EventSubChatNotificationSchema = z.object({
  metadata: z.object({
    message_id: z.string().min(1).max(100),
    message_type: z.literal("notification"),
    message_timestamp: TwitchTimestampSchema,
    subscription_type: z.literal("channel.chat.message"),
    subscription_version: z.literal("1"),
  }),
  payload: z.object({
    subscription: z.object({
      type: z.literal("channel.chat.message"),
      version: z.literal("1"),
      condition: z.object({ broadcaster_user_id: UserIdSchema }),
    }),
    event: z.object({
      broadcaster_user_id: UserIdSchema,
      chatter_user_id: UserIdSchema,
      chatter_user_login: z.string().min(1).max(50),
      chatter_user_name: z.string().min(1).max(50),
      message_id: z.string().min(1).max(100),
      message: z.object({ text: z.string().max(500) }),
    }),
  }),
});

export type EventSubNormalizationFailure =
  | "oversized"
  | "malformed"
  | "unsupported"
  | "wrong-channel"
  | "duplicate"
  | "out-of-order"
  | "stale-or-future";

export type EventSubNormalizationResult =
  | { ok: true; event: Extract<NormalizedChatEvent, { kind: "chat.message" }> }
  | { ok: false; reason: EventSubNormalizationFailure };

export interface EventSubNormalizerOptions {
  broadcasterUserId: string;
  now?: () => Date;
  maxMessageBytes?: number;
  maxAgeMs?: number;
}

/**
 * Offline-only parser for official-shaped channel.chat.message v1 packets.
 * It has no transport and is deliberately not wired into ForgeSession.
 */
export class EventSubChatNormalizer {
  private readonly seenMessageIds = new Set<string>();
  private lastOccurredAt = Number.NEGATIVE_INFINITY;
  private readonly now: () => Date;
  private readonly maxMessageBytes: number;
  private readonly maxAgeMs: number;

  constructor(private readonly options: EventSubNormalizerOptions) {
    if (!UserIdSchema.safeParse(options.broadcasterUserId).success)
      throw new Error("Expected a numeric Twitch broadcaster user ID");
    this.now = options.now ?? (() => new Date());
    this.maxMessageBytes = options.maxMessageBytes ?? 8 * 1024;
    this.maxAgeMs = options.maxAgeMs ?? 5 * 60 * 1000;
  }

  normalize(input: unknown): EventSubNormalizationResult {
    let serialized: string;
    try {
      serialized = JSON.stringify(input);
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (typeof serialized !== "string") return { ok: false, reason: "malformed" };
    if (Buffer.byteLength(serialized, "utf8") > this.maxMessageBytes)
      return { ok: false, reason: "oversized" };

    const header = z
      .object({ metadata: z.object({ message_type: z.string().max(50) }) })
      .safeParse(input);
    if (!header.success) return { ok: false, reason: "malformed" };
    if (header.data.metadata.message_type !== "notification")
      return { ok: false, reason: "unsupported" };

    const parsed = EventSubChatNotificationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "malformed" };
    const { metadata, payload } = parsed.data;
    const { event } = payload;
    if (
      payload.subscription.condition.broadcaster_user_id !== this.options.broadcasterUserId ||
      event.broadcaster_user_id !== this.options.broadcasterUserId
    )
      return { ok: false, reason: "wrong-channel" };
    if (this.seenMessageIds.has(event.message_id)) return { ok: false, reason: "duplicate" };

    const occurredAtMs = Date.parse(metadata.message_timestamp);
    const nowMs = this.now().getTime();
    if (
      !Number.isFinite(occurredAtMs) ||
      occurredAtMs > nowMs ||
      occurredAtMs < nowMs - this.maxAgeMs
    )
      return { ok: false, reason: "stale-or-future" };
    if (occurredAtMs < this.lastOccurredAt) return { ok: false, reason: "out-of-order" };

    this.remember(event.message_id);
    this.lastOccurredAt = occurredAtMs;
    const occurredAt = new Date(occurredAtMs).toISOString();
    const normalized = NormalizedChatEventSchema.parse({
      kind: "chat.message",
      provider: "twitch",
      message: {
        id: event.message_id,
        viewer: { id: event.chatter_user_id, displayName: event.chatter_user_name },
        text: event.message.text,
        occurredAt,
        ...(parseVoteCommand(event.message.text)
          ? { command: parseVoteCommand(event.message.text) }
          : {}),
      },
    });
    if (normalized.kind !== "chat.message") return { ok: false, reason: "malformed" };
    return { ok: true, event: normalized };
  }

  private remember(messageId: string): void {
    this.seenMessageIds.add(messageId);
    if (this.seenMessageIds.size > 4096) {
      const oldest = this.seenMessageIds.values().next().value as string | undefined;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
  }
}
