import type { NormalizedChatEvent, Provider } from "@bossforge/shared";

export interface ChatAdapter {
  readonly provider: Provider;
  readonly status: "connected" | "disconnected";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  nextEvent(): NormalizedChatEvent | undefined;
}
