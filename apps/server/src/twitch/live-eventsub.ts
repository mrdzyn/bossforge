import WebSocket from "ws";
import type { NormalizedChatEvent } from "@bossforge/shared";
import { EventSubChatNormalizer } from "./eventsub-normalizer.js";
import { EventSubSession, type EventSubSessionStatus } from "./eventsub-session.js";
import type { TwitchIdentity } from "./oauth.js";

export type LiveEventSubStatus = EventSubSessionStatus | "subscribing";

export interface LiveEventSubOptions {
  clientId: string;
  identity: TwitchIdentity;
  getAccessToken(): Promise<string | undefined>;
  refreshAccessToken?(): Promise<string | undefined>;
  onStatus(status: LiveEventSubStatus, connected: boolean): void;
  onChat(event: NormalizedChatEvent): void;
  fetch?: typeof fetch;
  createSocket?: (url: string) => WebSocket;
}

interface HelixSubscription {
  type?: string;
  version?: string;
  status?: string;
  condition?: { broadcaster_user_id?: string; user_id?: string };
  transport?: { session_id?: string };
}

function verifiedSubscription(
  item: HelixSubscription,
  identity: TwitchIdentity,
  sessionId: string,
): boolean {
  return (
    item.status === "enabled" &&
    item.type === "channel.chat.message" &&
    item.version === "1" &&
    item.condition?.broadcaster_user_id === identity.id &&
    item.condition?.user_id === identity.id &&
    item.transport?.session_id === sessionId
  );
}

/** Real outbound-only EventSub WebSocket + Helix subscriber. */
export class LiveEventSub {
  private readonly fetcher: typeof fetch;
  private readonly makeSocket: (url: string) => WebSocket;
  private readonly normalizer: EventSubChatNormalizer;
  private session: EventSubSession | undefined;
  private subscriptionActive = false;
  private stopped = false;
  private statusValue: LiveEventSubStatus = "idle";
  private subscriptionGeneration = 0;
  private welcomedSessionId: string | undefined;
  private activeTransport: { closed: boolean; welcomed: boolean } | undefined;

  constructor(private readonly options: LiveEventSubOptions) {
    this.fetcher = options.fetch ?? fetch;
    this.makeSocket =
      options.createSocket ?? ((url) => new WebSocket(url, { maxPayload: 64 * 1024 }));
    this.normalizer = new EventSubChatNormalizer({
      broadcasterUserId: options.identity.id,
      authorizedChatReaderUserId: options.identity.id,
    });
  }

  get status(): LiveEventSubStatus {
    if (this.session?.status === "failed" || this.session?.status === "revoked")
      return this.session.status;
    return this.statusValue;
  }

  get connected(): boolean {
    return this.subscriptionActive && this.session?.status === "connected";
  }

  start(): void {
    if (this.session || this.stopped) return;
    this.setStatus("connecting", false);
    this.session = new EventSubSession({
      initialUrl: "wss://eventsub.wss.twitch.tv/ws",
      createTransport: (url, handlers) => {
        const socket = this.makeSocket(url);
        const transport = { closed: false, welcomed: false };
        if (!this.activeTransport) this.activeTransport = transport;
        socket.on("message", (data) => {
          if (transport.closed || this.stopped) return;
          const raw = data.toString();
          try {
            const packet = JSON.parse(raw) as {
              metadata?: { message_type?: unknown };
              payload?: { session?: { id?: unknown } };
            };
            if (
              packet.metadata?.message_type === "session_welcome" &&
              typeof packet.payload?.session?.id === "string" &&
              !transport.welcomed
            ) {
              const wasConnected = this.subscriptionActive;
              this.subscriptionGeneration += 1;
              this.welcomedSessionId = packet.payload.session.id;
              transport.welcomed = true;
              this.activeTransport = transport;
              if (!wasConnected) this.subscriptionActive = false;
            }
            if (
              packet.metadata?.message_type === "revocation" &&
              this.activeTransport === transport &&
              transport.welcomed
            ) {
              this.subscriptionGeneration += 1;
              this.welcomedSessionId = undefined;
              this.subscriptionActive = false;
              this.setStatus("revoked", false);
            }
          } catch {
            // The lifecycle harness rejects malformed frames.
          }
          handlers.message(raw);
          if (this.session?.status === "connected" && this.subscriptionActive)
            this.setStatus("connected", true);
        });
        socket.on("ping", () => handlers.ping());
        const disconnected = () => {
          if (transport.closed) return;
          transport.closed = true;
          if (this.activeTransport !== transport || this.stopped) return;
          this.activeTransport = undefined;
          this.welcomedSessionId = undefined;
          this.subscriptionGeneration += 1;
          this.subscriptionActive = false;
          handlers.disconnect();
          this.setStatus(this.session?.status === "failed" ? "failed" : "reconnecting", false);
        };
        socket.once("close", disconnected);
        socket.once("error", disconnected);
        return {
          close: () => {
            transport.closed = true;
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
              socket.close();
          },
          // `ws` automatically answers control Ping frames with Pong.
        };
      },
      onNotification: (input) => {
        if (!this.subscriptionActive) return false;
        const result = this.normalizer.normalize(input);
        if (!result.ok) return false;
        this.options.onChat(result.event);
        return true;
      },
      onSubscriptionPlan: (sessionId, plan) => {
        if (plan === "handoff" && this.subscriptionActive) return;
        void this.subscribe(sessionId);
      },
    });
    this.session.start();
  }

  shutdown(): void {
    this.stopped = true;
    this.subscriptionGeneration += 1;
    this.welcomedSessionId = undefined;
    this.activeTransport = undefined;
    this.subscriptionActive = false;
    this.session?.shutdown();
    this.session = undefined;
    this.setStatus("stopped", false);
  }

  private async subscribe(sessionId: string): Promise<void> {
    if (this.stopped) return;
    const generation = ++this.subscriptionGeneration;
    const isCurrent = () =>
      !this.stopped &&
      generation === this.subscriptionGeneration &&
      this.welcomedSessionId === sessionId;
    this.subscriptionActive = false;
    this.setStatus("subscribing", false);
    try {
      const token = await this.options.getAccessToken();
      if (!isCurrent()) return;
      if (!token) throw new Error("No active Twitch authorization");
      let response = await this.createSubscription(token, sessionId);
      if (!isCurrent()) return;
      let activeToken = token;
      if (response.status === 401 && this.options.refreshAccessToken) {
        const refreshed = await this.options.refreshAccessToken();
        if (!isCurrent()) return;
        if (!refreshed) throw new Error("Twitch authorization expired");
        activeToken = refreshed;
        response = await this.createSubscription(activeToken, sessionId);
        if (!isCurrent()) return;
      }
      if (response.status === 409) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        let check: Response;
        try {
          check = await this.fetcher(
            "https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.chat.message&user_id=" +
              encodeURIComponent(this.options.identity.id),
            {
              headers: {
                "client-id": this.options.clientId,
                authorization: `Bearer ${activeToken}`,
              },
              redirect: "error",
              signal: controller.signal,
            },
          );
        } finally {
          clearTimeout(timeout);
        }
        if (!isCurrent()) return;
        if (!check.ok) throw new Error("Existing subscription could not be verified");
        const body = (await check.json()) as { data?: HelixSubscription[] };
        if (!isCurrent()) return;
        if (
          !body.data?.some((item) => verifiedSubscription(item, this.options.identity, sessionId))
        )
          throw new Error("Existing subscription did not match this EventSub session");
      } else if (response.status !== 202) {
        throw new Error("Twitch subscription request was rejected");
      } else {
        const body = (await response.json()) as { data?: HelixSubscription[] };
        if (!isCurrent()) return;
        if (
          !body.data?.some((item) => verifiedSubscription(item, this.options.identity, sessionId))
        )
          throw new Error("Twitch subscription was not enabled for this session");
      }
      if (!isCurrent()) return;
      this.subscriptionActive = true;
      this.setStatus("connected", true);
    } catch {
      if (!isCurrent()) return;
      this.subscriptionActive = false;
      this.setStatus("failed", false);
    }
  }

  private setStatus(status: LiveEventSubStatus, connected: boolean): void {
    this.statusValue = status;
    this.options.onStatus(status, connected);
  }

  private async createSubscription(token: string, sessionId: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      return await this.fetcher("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          "client-id": this.options.clientId,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "channel.chat.message",
          version: "1",
          condition: {
            broadcaster_user_id: this.options.identity.id,
            user_id: this.options.identity.id,
          },
          transport: { method: "websocket", session_id: sessionId },
        }),
        redirect: "error",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
