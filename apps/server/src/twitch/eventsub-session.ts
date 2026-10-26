import { z } from "zod";

const SessionWelcomeSchema = z.object({
  session: z.object({
    id: z.string().min(1).max(256),
    keepalive_timeout_seconds: z.number().int().min(1).max(600),
  }),
});
const SessionReconnectSchema = z.object({
  session: z.object({ reconnect_url: z.string().min(1).max(2048) }),
});
const RevocationSchema = z.object({
  subscription: z.object({ status: z.string().min(1).max(100) }),
});
const MessageHeaderSchema = z.object({
  metadata: z.object({
    message_id: z.string().min(1).max(100),
    message_type: z.string().min(1).max(50),
  }),
  payload: z.unknown(),
});

export type EventSubSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "retry-wait"
  | "revoked"
  | "failed"
  | "stopped";

export interface EventSubTransport {
  close(): void;
  pong?(): void;
}

export interface EventSubTransportHandlers {
  message(data: unknown): void;
  disconnect(): void;
  ping(): void;
}

export interface EventSubScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

export type SubscriptionPlan = "initial" | "resubscribe";

export interface EventSubSessionOptions {
  /** Supplied by the caller. Production Twitch transport is intentionally absent. */
  initialUrl: string;
  createTransport(url: string, handlers: EventSubTransportHandlers): EventSubTransport;
  onNotification(message: unknown): void;
  onSubscriptionPlan?(sessionId: string, plan: SubscriptionPlan): void;
  scheduler?: EventSubScheduler;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  connectionTimeoutMs?: number;
}

const realScheduler: EventSubScheduler = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

/**
 * Dependency-injected EventSub WebSocket lifecycle harness. It only consumes
 * transport callbacks; subscription plans are reported to an injected callback
 * and never sent over the WebSocket.
 */
export class EventSubSession {
  private statusValue: EventSubSessionStatus = "idle";
  private readonly scheduler: EventSubScheduler;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly connectionTimeoutMs: number;
  private readonly initialHost: string;
  private nextTransportId = 0;
  private activeTransportId: number | null = null;
  private pendingReconnectId: number | null = null;
  private readonly transports = new Map<number, EventSubTransport>();
  private readonly keepaliveTimers = new Map<number, { cancel: () => void; timeoutMs: number }>();
  private cancelRetry: (() => void) | undefined;
  private retries = 0;
  private hasWelcomed = false;
  private readonly seenIds = new Set<string>();

  constructor(private readonly options: EventSubSessionOptions) {
    const initialUrl = new URL(options.initialUrl);
    if (initialUrl.protocol !== "wss:" || initialUrl.username || initialUrl.password)
      throw new Error("EventSub transport URL must be a credential-free wss URL");
    this.initialHost = initialUrl.host.toLowerCase();
    this.scheduler = options.scheduler ?? realScheduler;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 500;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 10_000;
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0 || this.maxRetries > 10)
      throw new Error("EventSub retry count must be between 0 and 10");
    if (!Number.isInteger(this.baseRetryDelayMs) || this.baseRetryDelayMs < 1)
      throw new Error("EventSub retry delay must be a positive integer");
    if (
      !Number.isInteger(this.connectionTimeoutMs) ||
      this.connectionTimeoutMs < 1_000 ||
      this.connectionTimeoutMs > 60_000
    )
      throw new Error("EventSub connection timeout must be between 1000 and 60000 ms");
  }

  get status(): EventSubSessionStatus {
    return this.statusValue;
  }

  start(): void {
    if (this.statusValue !== "idle" && this.statusValue !== "stopped") return;
    this.statusValue = "connecting";
    this.open(this.options.initialUrl, false);
  }

  /** Feed one WebSocket text frame from an injected transport. */
  receive(data: unknown, transportId = this.activeTransportId): void {
    if (transportId === null || this.statusValue === "stopped" || this.statusValue === "revoked")
      return;
    const raw =
      typeof data === "string"
        ? data
        : data instanceof Uint8Array
          ? Buffer.from(data).toString("utf8")
          : null;
    if (raw === null || Buffer.byteLength(raw, "utf8") > 64 * 1024) return;
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = MessageHeaderSchema.safeParse(decoded);
    if (!parsed.success) return;
    if (transportId !== this.activeTransportId && transportId !== this.pendingReconnectId) return;
    this.resetKeepalive(transportId);
    const { metadata, payload } = parsed.data;
    if (this.seenIds.has(metadata.message_id)) return;
    this.remember(metadata.message_id);

    if (metadata.message_type === "session_welcome") {
      const welcome = SessionWelcomeSchema.safeParse(payload);
      if (!welcome.success) return;
      const wasReconnect = transportId === this.pendingReconnectId;
      if (wasReconnect && this.activeTransportId !== null) {
        this.closeTransport(this.activeTransportId);
        this.pendingReconnectId = null;
      }
      this.activeTransportId = transportId;
      this.statusValue = "connected";
      this.retries = 0;
      this.resetKeepalive(transportId, welcome.data.session.keepalive_timeout_seconds);
      if (!wasReconnect) {
        this.options.onSubscriptionPlan?.(
          welcome.data.session.id,
          this.hasWelcomed ? "resubscribe" : "initial",
        );
        this.hasWelcomed = true;
      }
      return;
    }

    if (transportId !== this.activeTransportId) return;

    switch (metadata.message_type) {
      case "session_keepalive":
        return;
      case "notification":
        this.options.onNotification(decoded);
        return;
      case "session_reconnect": {
        const reconnect = SessionReconnectSchema.safeParse(payload);
        if (!reconnect.success) return;
        let url: URL;
        try {
          url = new URL(reconnect.data.session.reconnect_url);
        } catch {
          return;
        }
        if (
          url.protocol !== "wss:" ||
          url.username ||
          url.password ||
          url.host.toLowerCase() !== this.initialHost
        )
          return;
        this.statusValue = "reconnecting";
        this.open(reconnect.data.session.reconnect_url, true);
        return;
      }
      case "revocation":
        if (!RevocationSchema.safeParse(payload).success) return;
        this.stopAs("revoked");
        return;
      default:
        return;
    }
  }

  /** Called for WebSocket control-frame pings; responds with a control pong. */
  receivePing(transportId = this.activeTransportId): void {
    if (transportId === null) return;
    this.transports.get(transportId)?.pong?.();
    this.resetKeepalive(transportId);
  }

  disconnect(transportId = this.activeTransportId): void {
    if (transportId === null || transportId !== this.activeTransportId) return;
    this.closeTransport(transportId);
    this.activeTransportId = null;
    if (this.pendingReconnectId !== null) {
      this.statusValue = "reconnecting";
      return;
    }
    this.scheduleRetry();
  }

  shutdown(): void {
    this.stopAs("stopped");
  }

  private open(url: string, reconnect: boolean): void {
    const transportId = ++this.nextTransportId;
    const transport = this.options.createTransport(url, {
      message: (message) => this.receive(message, transportId),
      disconnect: () => this.disconnect(transportId),
      ping: () => this.receivePing(transportId),
    });
    this.transports.set(transportId, transport);
    if (reconnect) this.pendingReconnectId = transportId;
    else {
      this.activeTransportId = transportId;
      this.statusValue = "connecting";
    }
    this.resetKeepalive(transportId, this.connectionTimeoutMs / 1000);
  }

  private resetKeepalive(transportId: number, timeoutSeconds?: number): void {
    if (transportId !== this.activeTransportId && transportId !== this.pendingReconnectId) return;
    const existing = this.keepaliveTimers.get(transportId);
    existing?.cancel();
    const timeoutMs =
      timeoutSeconds === undefined ? (existing?.timeoutMs ?? 0) : timeoutSeconds * 1000;
    this.keepaliveTimers.delete(transportId);
    if (timeoutMs <= 0) return;
    const cancel = this.scheduler.schedule(() => {
      this.keepaliveTimers.delete(transportId);
      if (transportId === this.pendingReconnectId) {
        this.closeTransport(transportId);
        this.pendingReconnectId = null;
        if (this.activeTransportId === null) this.scheduleRetry();
        else this.statusValue = "connected";
        return;
      }
      this.disconnect(transportId);
    }, timeoutMs);
    this.keepaliveTimers.set(transportId, { cancel, timeoutMs });
  }

  private scheduleRetry(): void {
    if (this.statusValue === "stopped" || this.statusValue === "revoked") return;
    if (this.retries >= this.maxRetries) {
      this.statusValue = "failed";
      return;
    }
    this.retries += 1;
    this.statusValue = "retry-wait";
    const delay = this.baseRetryDelayMs * 2 ** (this.retries - 1);
    this.cancelRetry = this.scheduler.schedule(() => {
      this.cancelRetry = undefined;
      if (this.statusValue !== "retry-wait") return;
      this.open(this.options.initialUrl, false);
    }, delay);
  }

  private closeTransport(id: number): void {
    const timer = this.keepaliveTimers.get(id);
    timer?.cancel();
    this.keepaliveTimers.delete(id);
    const transport = this.transports.get(id);
    if (!transport) return;
    this.transports.delete(id);
    transport.close();
  }

  private stopAs(status: "revoked" | "stopped"): void {
    this.cancelRetry?.();
    this.cancelRetry = undefined;
    for (const timer of this.keepaliveTimers.values()) timer.cancel();
    this.keepaliveTimers.clear();
    for (const id of this.transports.keys()) this.transports.get(id)?.close();
    this.transports.clear();
    this.activeTransportId = null;
    this.pendingReconnectId = null;
    this.statusValue = status;
  }

  private remember(id: string): void {
    this.seenIds.add(id);
    if (this.seenIds.size > 4096) {
      const oldest = this.seenIds.values().next().value as string | undefined;
      if (oldest) this.seenIds.delete(oldest);
    }
  }
}
