import { ProviderSchema, VoteCommandSchema } from "@bossforge/shared";
import { z } from "zod";

const ViewerIdentitySchema = z.object({
  id: z.string().min(1).max(64),
  displayName: z.string().min(1).max(50),
});
const ChatMessageSchema = z.object({
  id: z.string().min(1).max(100),
  viewer: ViewerIdentitySchema,
  text: z.string().max(500),
  occurredAt: z.string().datetime(),
  command: VoteCommandSchema.optional(),
});

/** Private ingress/ForgeSession contract. Never include this in browser schemas. */
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
export type ViewerIdentity = z.infer<typeof ViewerIdentitySchema>;
