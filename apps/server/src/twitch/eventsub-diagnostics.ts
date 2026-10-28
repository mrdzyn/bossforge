import type { EventSubSessionStatus } from "./eventsub-session.js";

export type EventSubDisconnectReason =
  | "socket-close"
  | "socket-error"
  | "keepalive-timeout"
  | "connection-timeout"
  | "revoked"
  | "transport-unknown";

export type EventSubSocketErrorClass =
  | "connection-reset"
  | "connection-refused"
  | "network-unreachable"
  | "dns-failure"
  | "timeout"
  | "tls-failure"
  | "other";

export type ForgeBallotReason =
  | "accepted"
  | "wrong-event"
  | "wrong-provider"
  | "disconnected"
  | "duplicate-message"
  | "inactive-voting"
  | "invalid-timestamp"
  | "late-or-future-timestamp"
  | "invalid-viewer"
  | "wrong-category"
  | "invalid-choice"
  | "unchanged-choice";
export type EventSubDiagnosticsStatus = EventSubSessionStatus | "subscribing";
export type ForgeCancellationReason = EventSubDisconnectReason | "subscription-failed" | "stopped";

export interface EventSubDiagnosticsSnapshot {
  counters: {
    rawFrames: number;
    malformedFrames: number;
    validWelcomes: number;
    keepalives: number;
    notificationsReceived: number;
    notificationsAccepted: number;
    notificationsRejected: number;
    normalizedAccepted: number;
    normalizedRejected: number;
    chatCallbacks: number;
    subscriptionAttempts: number;
    subscriptionEnabled: number;
    subscriptionFailed: number;
    reconnectInstructions: number;
    reconnectHandoffTimeouts: number;
    handoffWelcomes: number;
    socketCloses: number;
    socketErrors: number;
    forgeCancellations: number;
    ballotsAccepted: number;
    ballotsRejected: number;
  };
  disconnectReasons: Record<EventSubDisconnectReason, number>;
  forgeCancellationReasons: Record<ForgeCancellationReason, number>;
  socketErrorClasses: Record<EventSubSocketErrorClass, number>;
  closeCodes: Record<string, number>;
  ballotReasons: Record<ForgeBallotReason, number>;
  statusCounts: Record<EventSubDiagnosticsStatus, number>;
  keepalive: { lastElapsedMs: number | null; advertisedTimeoutMs: number | null };
  lastDisconnect: {
    reason: EventSubDisconnectReason;
    closeCode: number | null;
    errorClass: EventSubSocketErrorClass | null;
    elapsedMs: number | null;
    timeoutMs: number | null;
  } | null;
}

const zeroRecord = <T extends string>(keys: readonly T[]): Record<T, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
const MAX_DIAGNOSTIC_COUNT = 1_000_000;
const incrementBounded = (record: Record<string, number>, key: string): void => {
  record[key] = Math.min(MAX_DIAGNOSTIC_COUNT, (record[key] ?? 0) + 1);
};

const DISCONNECT_REASONS: readonly EventSubDisconnectReason[] = [
  "socket-close",
  "socket-error",
  "keepalive-timeout",
  "connection-timeout",
  "revoked",
  "transport-unknown",
];
const SOCKET_ERROR_CLASSES: readonly EventSubSocketErrorClass[] = [
  "connection-reset",
  "connection-refused",
  "network-unreachable",
  "dns-failure",
  "timeout",
  "tls-failure",
  "other",
];
const FORGE_CANCELLATION_REASONS: readonly ForgeCancellationReason[] = [
  ...DISCONNECT_REASONS,
  "subscription-failed",
  "stopped",
];
const BALLOT_REASONS: readonly ForgeBallotReason[] = [
  "accepted",
  "wrong-event",
  "wrong-provider",
  "disconnected",
  "duplicate-message",
  "inactive-voting",
  "invalid-timestamp",
  "late-or-future-timestamp",
  "invalid-viewer",
  "wrong-category",
  "invalid-choice",
  "unchanged-choice",
];
const SESSION_STATUSES: readonly EventSubDiagnosticsStatus[] = [
  "idle",
  "connecting",
  "connected",
  "reconnecting",
  "retry-wait",
  "revoked",
  "failed",
  "stopped",
  "subscribing",
];

const emptyCounters = (): EventSubDiagnosticsSnapshot["counters"] => ({
  rawFrames: 0,
  malformedFrames: 0,
  validWelcomes: 0,
  keepalives: 0,
  notificationsReceived: 0,
  notificationsAccepted: 0,
  notificationsRejected: 0,
  normalizedAccepted: 0,
  normalizedRejected: 0,
  chatCallbacks: 0,
  subscriptionAttempts: 0,
  subscriptionEnabled: 0,
  subscriptionFailed: 0,
  reconnectInstructions: 0,
  reconnectHandoffTimeouts: 0,
  handoffWelcomes: 0,
  socketCloses: 0,
  socketErrors: 0,
  forgeCancellations: 0,
  ballotsAccepted: 0,
  ballotsRejected: 0,
});

/** Volatile, bounded counters. No message, identity, URL, or session data is retained. */
export class EventSubDiagnostics {
  private readonly counters = emptyCounters();
  private readonly disconnectReasons = zeroRecord(DISCONNECT_REASONS);
  private readonly forgeCancellationReasons = zeroRecord(FORGE_CANCELLATION_REASONS);
  private readonly socketErrorClasses = zeroRecord(SOCKET_ERROR_CLASSES);
  private readonly ballotReasons = zeroRecord(BALLOT_REASONS);
  private readonly statusCounts = zeroRecord(SESSION_STATUSES);
  private readonly closeCodes: Record<string, number> = {};
  private keepalive = {
    lastElapsedMs: null as number | null,
    advertisedTimeoutMs: null as number | null,
  };
  private lastDisconnect: EventSubDiagnosticsSnapshot["lastDisconnect"] = null;

  increment(counter: keyof EventSubDiagnosticsSnapshot["counters"]): void {
    this.counters[counter] = Math.min(MAX_DIAGNOSTIC_COUNT, this.counters[counter] + 1);
  }

  recordStatus(status: EventSubDiagnosticsStatus): void {
    incrementBounded(this.statusCounts, status);
  }

  recordClose(code: number | null): void {
    this.increment("socketCloses");
    if (code !== null && Number.isInteger(code) && code >= 1000 && code <= 4999) {
      const key = String(code);
      incrementBounded(this.closeCodes, key);
    }
  }

  recordSocketError(errorClass: EventSubSocketErrorClass): void {
    this.increment("socketErrors");
    incrementBounded(this.socketErrorClasses, errorClass);
  }

  recordKeepalive(elapsedMs: number, timeoutMs: number): void {
    this.keepalive = {
      lastElapsedMs: this.safeDuration(elapsedMs),
      advertisedTimeoutMs: this.safeDuration(timeoutMs),
    };
  }

  recordDisconnect(
    reason: EventSubDisconnectReason,
    detail: {
      closeCode?: number | null;
      errorClass?: EventSubSocketErrorClass | null;
      elapsedMs?: number | null;
      timeoutMs?: number | null;
    } = {},
  ): void {
    incrementBounded(this.disconnectReasons, reason);
    this.lastDisconnect = {
      reason,
      closeCode: detail.closeCode ?? null,
      errorClass: detail.errorClass ?? null,
      elapsedMs: detail.elapsedMs == null ? null : this.safeDuration(detail.elapsedMs),
      timeoutMs: detail.timeoutMs == null ? null : this.safeDuration(detail.timeoutMs),
    };
  }

  recordBallot(reason: ForgeBallotReason): void {
    incrementBounded(this.ballotReasons, reason);
    if (reason === "accepted") this.increment("ballotsAccepted");
    else this.increment("ballotsRejected");
  }

  recordForgeCancellation(reason: ForgeCancellationReason): void {
    this.increment("forgeCancellations");
    incrementBounded(this.forgeCancellationReasons, reason);
  }

  snapshot(): EventSubDiagnosticsSnapshot {
    return {
      counters: { ...this.counters },
      disconnectReasons: { ...this.disconnectReasons },
      forgeCancellationReasons: { ...this.forgeCancellationReasons },
      socketErrorClasses: { ...this.socketErrorClasses },
      closeCodes: { ...this.closeCodes },
      ballotReasons: { ...this.ballotReasons },
      statusCounts: { ...this.statusCounts },
      keepalive: { ...this.keepalive },
      lastDisconnect: this.lastDisconnect ? { ...this.lastDisconnect } : null,
    };
  }

  private safeDuration(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(600_000, Math.round(value)));
  }
}

export function classifySocketError(error: unknown): EventSubSocketErrorClass {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.toUpperCase()
      : "";
  if (code === "ECONNRESET") return "connection-reset";
  if (code === "ECONNREFUSED") return "connection-refused";
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") return "network-unreachable";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns-failure";
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return "timeout";
  if (code.startsWith("ERR_TLS_") || code.startsWith("CERT_")) return "tls-failure";
  return "other";
}
