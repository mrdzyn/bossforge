import { parseVoteCommand } from "@bossforge/shared";
import {
  NormalizedChatEventSchema,
  type NormalizedChatEvent,
  type ViewerIdentity,
} from "../events/normalized-chat-event.js";
import type { ChatAdapter } from "./chat-adapter.js";

const syntheticViewer: ViewerIdentity = { id: "mock-ember-01", displayName: "EmberFan" };

export class MockChatAdapter implements ChatAdapter {
  readonly provider = "mock" as const;
  #status: "connected" | "disconnected" = "disconnected";
  #eventIndex = 0;
  readonly #now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.#now = now;
  }

  get status(): "connected" | "disconnected" {
    return this.#status;
  }

  async connect(): Promise<void> {
    this.#status = "connected";
  }

  async disconnect(): Promise<void> {
    this.#status = "disconnected";
  }

  nextEvent(): NormalizedChatEvent | undefined {
    if (this.#status !== "connected") return undefined;

    const timestamp = this.#now().toISOString();
    const eventIndex = this.#eventIndex++;
    const events: NormalizedChatEvent[] = [
      {
        kind: "viewer.connected",
        provider: "mock",
        viewer: syntheticViewer,
        occurredAt: timestamp,
      },
      {
        kind: "chat.message",
        provider: "mock",
        message: {
          id: `mock-message-${eventIndex}`,
          viewer: syntheticViewer,
          text: "The chat is ready to forge a boss!",
          occurredAt: timestamp,
        },
      },
      {
        kind: "chat.message",
        provider: "mock",
        message: {
          id: `mock-message-${eventIndex}`,
          viewer: syntheticViewer,
          text: "!vote element fire",
          occurredAt: timestamp,
          command: parseVoteCommand("!vote element fire"),
        },
      },
      {
        kind: "viewer.disconnected",
        provider: "mock",
        viewer: syntheticViewer,
        occurredAt: timestamp,
      },
    ];
    const event = events[eventIndex];
    return event ? NormalizedChatEventSchema.parse(event) : undefined;
  }
}
