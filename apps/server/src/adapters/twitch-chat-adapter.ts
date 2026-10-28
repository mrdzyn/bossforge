import type { NormalizedChatEvent } from "../events/normalized-chat-event.js";
import type { ChatAdapter } from "./chat-adapter.js";

/** Phase 0 boundary only. Real OAuth and EventSub transport are deferred. */
export class TwitchChatAdapter implements ChatAdapter {
  readonly provider = "twitch" as const;
  readonly status = "disconnected" as const;

  async connect(): Promise<void> {
    throw new Error("Twitch chat integration is not implemented in Phase 0.");
  }

  async disconnect(): Promise<void> {
    // There is no Twitch connection to close in this phase.
  }

  nextEvent(): NormalizedChatEvent | undefined {
    return undefined;
  }
}
