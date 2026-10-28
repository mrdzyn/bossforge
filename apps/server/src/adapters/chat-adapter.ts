import type { Provider } from "@bossforge/shared";
import type { NormalizedChatEvent } from "../events/normalized-chat-event.js";

export interface ChatAdapter {
  readonly provider: Provider;
  readonly status: "connected" | "disconnected";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  nextEvent(): NormalizedChatEvent | undefined;
}
