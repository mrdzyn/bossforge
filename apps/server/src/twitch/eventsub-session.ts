import { z } from "zod";
import { EventSubDiagnostics, type EventSubSocketErrorClass } from "./eventsub-diagnostics.js";

export type EventSubDisconnectDetails =
  | { reason: "socket-close"; closeCode: number | null }
  | { reason: "socket-error"; errorClass: EventSubSocketErrorClass }
  | { reason: "keepalive-timeout" | "connection-timeout" | "transport-unknown" };

const SessionWelcomeSchema = z.object({
  session: z.object({
    id: z.string().min(1).max(256),
    keepalive_timeout_seconds: z.number().int().min(1).max(600),
  }),
});
const SessionReconnectSchema = z.object({
  session: z.object({ reconnect_url: z.string().min(1).max(2048) }),
});
const SessionKeepaliveSchema = z.object({}).strict();
const RevocationSchema = z.object({
  subscription: z.object({ status: z.string().min(1).max(100) }),
});
const RFC3339_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const EventSubTimestampSchema = z
  .string()
  .regex(RFC3339_TIMESTAMP)
  .refine((timestamp) => Number.isFinite(Date.parse(timestamp)));
// Twitch says a session is lost only after no notification or keepalive has
// arrived for longer than its advertised window. Allow a small scheduling
// margin around that boundary while still rechecking with a monotonic clock.
export const KEEPALIVE_TIMEOUT_GRACE_MS = 250;
const MessageHeaderSchema = z.object({
  metadata: z.object({
    message_id: z.string().min(1).max(100),
    message_type: z.string().min(1).max(50),
    message_timestamp: EventSubTimestampSchema,
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
  disconnect(details?: EventSubDisconnectDetails): void;
  ping(): void;
}

export interface EventSubScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

export type SubscriptionPlan = "initial" | "resubscribe" | "handoff";
export type EventSubSessionLossStatus = "reconnecting" | "retry-wait" | "failed";

export interface EventSubSessionOptions {
  /** Supplied by the caller. Production Twitch transport is intentionally absent. */
  initialUrl: string;
  createTransport(url: string, handlers: EventSubTransportHandlers): EventSubTransport;
  /** Return true only after the notification has passed its application schema. */
  onNotification(message: unknown): boolean;
  onSubscriptionPlan?(sessionId: string, plan: SubscriptionPlan): void;
  onValidatedWelcome?(sessionId: string, transportId: number, handoff: boolean): void;
  onValidatedRevocation?(status: string, transportId: number): void;
  onSessionLost?(
    sessionId: string,
    transportId: number,
    status: EventSubSessionLossStatus,
    details: EventSubDisconnectDetails,
  ): void;
  onStatusChange?(status: EventSubSessionStatus): void;
  scheduler?: EventSubScheduler;
  diagnostics?: EventSubDiagnostics;
  monotonicNow?: () => number;
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
  private readonly welcomedTransports = new Map<number, string>();
  private readonly keepaliveTimers = new Map<
    number,
    { cancel: () => void; timeoutMs: number; lastHealthAt: number }
  >();
  private cancelRetry: (() => void) | undefined;
  private retries = 0;
  private hasWelcomed = false;
  private readonly seenIds = new Set<string>();
  private readonly monotonicNow: () => number;
  private readonly lastHealthMessageAt = new Map<number, number>();

  constructor(private readonly options: EventSubSessionOptions) {
    const initialUrl = new URL(options.initialUrl);
    if (initialUrl.protocol !== "wss:" || initialUrl.username || initialUrl.password)
      throw new Error("EventSub transport URL must be a credential-free wss URL");
    this.initialHost = initialUrl.host.toLowerCase();
    this.scheduler = options.scheduler ?? realScheduler;
    this.monotonicNow = options.monotonicNow ?? (() => performance.now());
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
    this.setStatus("connecting");
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
    this.options.diagnostics?.increment("rawFrames");
    if (raw === null || Buffer.byteLength(raw, "utf8") > 64 * 1024) {
      this.options.diagnostics?.increment("malformedFrames");
      return;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      this.options.diagnostics?.increment("malformedFrames");
      return;
    }
    const parsed = MessageHeaderSchema.safeParse(decoded);
    if (!parsed.success) {
      this.options.diagnostics?.increment("malformedFrames");
      return;
    }
    if (transportId !== this.activeTransportId && transportId !== this.pendingReconnectId) return;
    const { metadata, payload } = parsed.data;
    if (this.seenIds.has(metadata.message_id)) return;

    if (metadata.message_type === "session_welcome") {
      const welcome = SessionWelcomeSchema.safeParse(payload);
      if (!welcome.success || this.welcomedTransports.has(transportId)) return;
      this.remember(metadata.message_id);
      const wasReconnect = transportId === this.pendingReconnectId;
      this.options.diagnostics?.increment("validWelcomes");
      if (wasReconnect) this.options.diagnostics?.increment("handoffWelcomes");
      if (wasReconnect) {
        if (this.activeTransportId !== null && this.activeTransportId !== transportId)
          this.closeTransport(this.activeTransportId);
        this.pendingReconnectId = null;
      }
      this.activeTransportId = transportId;
      this.welcomedTransports.set(transportId, welcome.data.session.id);
      this.setStatus("connected");
      this.retries = 0;
      this.resetKeepalive(transportId, welcome.data.session.keepalive_timeout_seconds);
      this.options.onValidatedWelcome?.(welcome.data.session.id, transportId, wasReconnect);
      if (wasReconnect) {
        this.options.onSubscriptionPlan?.(welcome.data.session.id, "handoff");
      } else {
        this.options.onSubscriptionPlan?.(
          welcome.data.session.id,
          this.hasWelcomed ? "resubscribe" : "initial",
        );
        this.hasWelcomed = true;
      }
      return;
    }

    if (transportId !== this.activeTransportId) return;
    if (!this.welcomedTransports.has(transportId)) return;

    switch (metadata.message_type) {
      case "session_keepalive": {
        if (!SessionKeepaliveSchema.safeParse(payload).success) return;
        this.remember(metadata.message_id);
        this.options.diagnostics?.increment("keepalives");
        this.resetKeepalive(transportId);
        return;
      }
      case "notification": {
        this.options.diagnostics?.increment("notificationsReceived");
        const accepted = (() => {
          try {
            return this.options.onNotification(decoded);
          } catch {
            return false;
          }
        })();
        this.options.diagnostics?.increment(
          accepted ? "notificationsAccepted" : "notificationsRejected",
        );
        if (!accepted) return;
        this.remember(metadata.message_id);
        this.resetKeepalive(transportId);
        return;
      }
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
        this.remember(metadata.message_id);
        this.options.diagnostics?.increment("reconnectInstructions");
        this.setStatus("reconnecting");
        // Twitch can issue another reconnect instruction before the current
        // replacement welcomes. Retire that pending socket before opening a
        // new one so there is never an orphaned transport.
        if (this.pendingReconnectId !== null) this.closeTransport(this.pendingReconnectId);
        this.open(reconnect.data.session.reconnect_url, true);
        return;
      }
      case "revocation":
        {
          const revocation = RevocationSchema.safeParse(payload);
          if (!revocation.success) return;
          this.options.diagnostics?.recordDisconnect("revoked");
          this.options.onValidatedRevocation?.(revocation.data.subscription.status, transportId);
        }
        this.remember(metadata.message_id);
        this.stopAs("revoked");
        return;
      default:
        return;
    }
  }

  /** Called for WebSocket control-frame pings; responds with a control pong. */
  receivePing(transportId = this.activeTransportId): void {
    if (transportId === null) return;
    if (transportId !== this.activeTransportId && transportId !== this.pendingReconnectId) return;
    this.transports.get(transportId)?.pong?.();
  }

  disconnect(
    transportId = this.activeTransportId,
    details: EventSubDisconnectDetails = { reason: "transport-unknown" },
  ): void {
    if (transportId === null || transportId !== this.activeTransportId) return;
    const sessionId = this.welcomedTransports.get(transportId);
    const timeoutMs = this.keepaliveTimers.get(transportId)?.timeoutMs ?? null;
    const elapsedMs = this.lastHealthMessageAt.has(transportId)
      ? this.monotonicNow() - this.lastHealthMessageAt.get(transportId)!
      : null;
    this.options.diagnostics?.recordDisconnect(details.reason, {
      closeCode: details.reason === "socket-close" ? details.closeCode : null,
      errorClass: details.reason === "socket-error" ? details.errorClass : null,
      elapsedMs,
      timeoutMs,
    });
    this.closeTransport(transportId);
    this.activeTransportId = null;
    let lossStatus: EventSubSessionLossStatus;
    if (this.pendingReconnectId !== null) {
      this.setStatus("reconnecting");
      lossStatus = "reconnecting";
    } else {
      this.scheduleRetry();
      lossStatus = this.statusValue as EventSubSessionLossStatus;
    }
    if (sessionId) this.options.onSessionLost?.(sessionId, transportId, lossStatus, details);
  }

  shutdown(): void {
    this.stopAs("stopped");
  }

  private open(url: string, reconnect: boolean): void {
    const transportId = ++this.nextTransportId;
    const transport = this.options.createTransport(url, {
      message: (message) => this.receive(message, transportId),
      disconnect: (details) => this.disconnect(transportId, details),
      ping: () => this.receivePing(transportId),
    });
    this.transports.set(transportId, transport);
    if (reconnect) this.pendingReconnectId = transportId;
    else {
      this.activeTransportId = transportId;
      this.setStatus("connecting");
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
    const lastHealthAt = this.monotonicNow();
    this.lastHealthMessageAt.set(transportId, lastHealthAt);
    const armWatchdog = (delayMs: number): void => {
      const entry: { cancel: () => void; timeoutMs: number; lastHealthAt: number } = {
        cancel: () => undefined,
        timeoutMs,
        lastHealthAt,
      };
      this.keepaliveTimers.set(transportId, entry);
      entry.cancel = this.scheduler.schedule(() => {
        // A canceled callback may already be queued. It must not act on a
        // refreshed deadline or a replacement transport.
        if (this.keepaliveTimers.get(transportId) !== entry) return;
        if (this.activeTransportId !== transportId && this.pendingReconnectId !== transportId)
          return;
        const latestHealthAt = this.lastHealthMessageAt.get(transportId);
        if (latestHealthAt === undefined || latestHealthAt !== entry.lastHealthAt) return;
        const elapsedMs = Math.max(0, this.monotonicNow() - latestHealthAt);
        const welcomed = this.welcomedTransports.has(transportId);
        const allowedMs = timeoutMs + (welcomed ? KEEPALIVE_TIMEOUT_GRACE_MS : 0);
        this.options.diagnostics?.recordKeepalive(elapsedMs, timeoutMs);
        if (elapsedMs < allowedMs) {
          armWatchdog(Math.max(1, allowedMs - elapsedMs));
          return;
        }
        if (transportId === this.pendingReconnectId) {
          this.options.diagnostics?.increment("reconnectHandoffTimeouts");
          this.closeTransport(transportId);
          this.pendingReconnectId = null;
          if (this.activeTransportId === null) this.scheduleRetry();
          else this.setStatus("connected");
          return;
        }
        this.disconnect(transportId, {
          reason: welcomed ? "keepalive-timeout" : "connection-timeout",
        });
      }, delayMs);
    };
    armWatchdog(timeoutMs);
  }

  private scheduleRetry(): void {
    if (this.statusValue === "stopped" || this.statusValue === "revoked") return;
    if (this.retries >= this.maxRetries) {
      this.setStatus("failed");
      return;
    }
    this.retries += 1;
    this.setStatus("retry-wait");
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
    this.lastHealthMessageAt.delete(id);
    const transport = this.transports.get(id);
    if (!transport) return;
    this.transports.delete(id);
    this.welcomedTransports.delete(id);
    transport.close();
  }

  private stopAs(status: "revoked" | "stopped"): void {
    this.cancelRetry?.();
    this.cancelRetry = undefined;
    for (const timer of this.keepaliveTimers.values()) timer.cancel();
    this.keepaliveTimers.clear();
    this.lastHealthMessageAt.clear();
    for (const id of this.transports.keys()) this.transports.get(id)?.close();
    this.transports.clear();
    this.welcomedTransports.clear();
    this.activeTransportId = null;
    this.pendingReconnectId = null;
    this.setStatus(status);
  }

  private setStatus(status: EventSubSessionStatus): void {
    if (this.statusValue === status) return;
    this.statusValue = status;
    this.options.diagnostics?.recordStatus(status);
    this.options.onStatusChange?.(status);
  }

  private remember(id: string): void {
    this.seenIds.add(id);
    if (this.seenIds.size > 4096) {
      const oldest = this.seenIds.values().next().value as string | undefined;
      if (oldest) this.seenIds.delete(oldest);
    }
  }
}
