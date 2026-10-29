import { randomUUID } from "node:crypto";
import {
  DashboardEventEnvelopeSchema,
  OverlayEventEnvelopeSchema,
  PublicForgeStateSchema,
  CommunityBattleStateV1Schema,
  OverlayBattleStateV1Schema,
  type DashboardActivity,
  type ForgeState,
  type CommunityBattleStateV1,
} from "@bossforge/shared";
import type WebSocket from "ws";

type PublicPayload =
  | { kind: "forge.state"; source: "mock" | "twitch"; state: ForgeState }
  | {
      kind: "connection.status";
      source: "mock" | "twitch";
      status: "connecting" | "connected" | "disconnected" | "error";
    }
  | { kind: "battle.state"; state: CommunityBattleStateV1 }
  | DashboardActivity;

export class EventHub {
  readonly #dashboardClients = new Set<WebSocket>();
  readonly #overlayClients = new Set<WebSocket>();

  get clientCount(): number {
    return this.#dashboardClients.size + this.#overlayClients.size;
  }

  addDashboardClient(client: WebSocket): void {
    this.add(client, this.#dashboardClients);
  }

  addOverlayClient(client: WebSocket): void {
    this.add(client, this.#overlayClients);
  }

  publishDashboard(payload: PublicPayload): void {
    this.sendTo(this.#dashboardClients, payload, "dashboard");
  }

  publishOverlay(payload: Exclude<PublicPayload, DashboardActivity>): void {
    this.sendTo(this.#overlayClients, payload, "overlay");
  }

  sendDashboard(client: WebSocket, payload: PublicPayload): void {
    this.sendOne(client, payload, "dashboard");
  }

  sendOverlay(client: WebSocket, payload: Exclude<PublicPayload, DashboardActivity>): void {
    this.sendOne(client, payload, "overlay");
  }

  private add(client: WebSocket, clients: Set<WebSocket>): void {
    clients.add(client);
    client.once("close", () => clients.delete(client));
    client.once("error", () => clients.delete(client));
  }

  private sendTo(
    clients: Set<WebSocket>,
    payload: PublicPayload,
    recipient: "dashboard" | "overlay",
  ): void {
    for (const client of clients) this.sendOne(client, payload, recipient);
  }

  private sendOne(
    client: WebSocket,
    payload: PublicPayload,
    recipient: "dashboard" | "overlay",
  ): void {
    if (client.readyState !== 1) return;
    let safePayload: Record<string, unknown>;
    try {
      safePayload = this.project(payload, recipient);
    } catch {
      return;
    }
    const type =
      safePayload.kind === "connection.status"
        ? "connection.status"
        : safePayload.kind === "forge.state"
          ? "forge.state"
          : safePayload.kind === "battle.state"
            ? "battle.state"
            : "dashboard.activity";
    const candidate = {
      type,
      schemaVersion: 1,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      payload: safePayload,
    };
    const parsed =
      recipient === "dashboard"
        ? DashboardEventEnvelopeSchema.safeParse(candidate)
        : OverlayEventEnvelopeSchema.safeParse(candidate);
    if (parsed.success) client.send(JSON.stringify(parsed.data));
  }

  private project(
    payload: PublicPayload,
    recipient: "dashboard" | "overlay",
  ): Record<string, unknown> {
    if ("kind" in payload && payload.kind === "forge.state") {
      // Construct an explicit DTO before strict validation. This prevents internal
      // additions from silently becoming browser-visible fields.
      return {
        kind: payload.kind,
        source: payload.source,
        state: toPublicForgeState(payload.state),
      };
    }
    if ("kind" in payload && payload.kind === "connection.status")
      return { kind: "connection.status", source: payload.source, status: payload.status };
    if ("kind" in payload && payload.kind === "battle.state")
      return {
        kind: "battle.state",
        state:
          recipient === "overlay"
            ? toOverlayBattleState(payload.state)
            : toPublicBattleState(payload.state),
      };
    const activity = payload as DashboardActivity;
    return {
      serverInstanceId: activity.serverInstanceId,
      cycleId: activity.cycleId,
      accepted: activity.accepted,
      rejected: activity.rejected,
      reasons: {
        invalid: activity.reasons.invalid,
        duplicate: activity.reasons.duplicate,
        inactive: activity.reasons.inactive,
        other: activity.reasons.other,
      },
    };
  }
}

export function toPublicForgeState(state: ForgeState) {
  const projected = {
    serverInstanceId: state.serverInstanceId,
    serverStartedAt: state.serverStartedAt,
    revision: state.revision,
    cycleId: state.cycleId,
    status: state.status,
    mode: state.mode,
    simulated: state.simulated,
    connectedToTwitch: state.connectedToTwitch,
    durationSeconds: state.durationSeconds,
    startedAt: state.startedAt,
    activeCategory: state.activeCategory,
    progress: state.progress,
    categories: state.categories.map((category) => ({
      category: category.category,
      status: category.status,
      options: category.options.map((option) => ({
        choice: option.choice,
        count: option.count,
        percentage: option.percentage,
      })),
      totalVotes: category.totalVotes,
      openedAt: category.openedAt,
      closesAt: category.closesAt,
      winner: category.winner,
      noVoteFallback: category.noVoteFallback,
    })),
    boss: state.boss
      ? {
          id: state.boss.id,
          name: state.boss.name,
          attributes: {
            body: state.boss.attributes.body,
            element: state.boss.attributes.element,
            special: state.boss.attributes.special,
            weakness: state.boss.attributes.weakness,
          },
          stats: {
            health: state.boss.stats.health,
            damage: state.boss.stats.damage,
            attackIntervalMs: state.boss.stats.attackIntervalMs,
          },
        }
      : null,
  };
  return PublicForgeStateSchema.parse(projected);
}

export function toPublicBattleState(state: CommunityBattleStateV1): CommunityBattleStateV1 {
  return CommunityBattleStateV1Schema.parse({
    schemaVersion: state.schemaVersion,
    serverInstanceId: state.serverInstanceId,
    serverStartedAt: state.serverStartedAt,
    revision: state.revision,
    status: state.status,
    forgeIdentity: state.forgeIdentity ? { ...state.forgeIdentity } : null,
    encounterId: state.encounterId,
    forgeCycleId: state.forgeCycleId,
    bossSnapshot: state.bossSnapshot
      ? {
          id: state.bossSnapshot.id,
          name: state.bossSnapshot.name,
          attributes: { ...state.bossSnapshot.attributes },
        }
      : null,
    profileId: state.profileId,
    profileVersion: state.profileVersion,
    profileSnapshot: state.profileSnapshot ? structuredClone(state.profileSnapshot) : null,
    audienceBand: state.audienceBand,
    durationSeconds: state.durationSeconds,
    startedAt: state.startedAt,
    deadlineAt: state.deadlineAt,
    currentHp: state.currentHp,
    maxHp: state.maxHp,
    acceptedHitCount: state.acceptedHitCount,
    baseHitCount: state.baseHitCount,
    weaknessHitCount: state.weaknessHitCount,
    damageApplied: state.damageApplied,
    cancelReason: state.cancelReason,
  });
}

export function toOverlayBattleState(state: CommunityBattleStateV1) {
  return OverlayBattleStateV1Schema.parse({
    schemaVersion: state.schemaVersion,
    serverInstanceId: state.serverInstanceId,
    serverStartedAt: state.serverStartedAt,
    revision: state.revision,
    status: state.status,
    forgeIdentity: state.forgeIdentity ? { ...state.forgeIdentity } : null,
    encounterId: state.encounterId,
    forgeCycleId: state.forgeCycleId,
    bossSnapshot: state.bossSnapshot
      ? {
          id: state.bossSnapshot.id,
          name: state.bossSnapshot.name,
          attributes: { ...state.bossSnapshot.attributes },
        }
      : null,
    audienceBand: state.audienceBand,
    durationSeconds: state.durationSeconds,
    startedAt: state.startedAt,
    deadlineAt: state.deadlineAt,
    currentHp: state.currentHp,
    maxHp: state.maxHp,
    acceptedHitCount: state.acceptedHitCount,
    baseHitCount: state.baseHitCount,
    weaknessHitCount: state.weaknessHitCount,
    damageApplied: state.damageApplied,
    cancelReason: state.cancelReason,
  });
}
