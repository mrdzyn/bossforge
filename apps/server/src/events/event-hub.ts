import { randomUUID } from "node:crypto";
import { createEventEnvelope, type AppEventPayload } from "@bossforge/shared";
import type WebSocket from "ws";

export class EventHub {
  readonly #clients = new Set<WebSocket>();

  get clientCount(): number {
    return this.#clients.size;
  }

  addClient(client: WebSocket): void {
    this.#clients.add(client);
    client.once("close", () => this.#clients.delete(client));
    client.once("error", () => this.#clients.delete(client));
  }

  publish(payload: AppEventPayload): void {
    const envelope = createEventEnvelope(payload, randomUUID(), new Date().toISOString());
    const serialized = JSON.stringify(envelope);
    for (const client of this.#clients) {
      if (client.readyState === 1) client.send(serialized);
    }
  }
}
