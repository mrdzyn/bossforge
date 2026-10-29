import type { ForgeState, OverlayBattleStateV1 } from "@bossforge/shared";

export type OverlayBattleView =
  | "unavailable"
  | "awaiting"
  | "voting"
  | "waiting-battle"
  | "disconnected"
  | "ready"
  | "active"
  | "victory"
  | "expired"
  | "cancelled";

export function shouldAnimateAcceptedHits(
  previous: OverlayBattleStateV1 | null,
  next: OverlayBattleStateV1 | null,
  view: OverlayBattleView,
): boolean {
  return Boolean(
    view === "active" &&
    previous?.status === "active" &&
    next?.status === "active" &&
    previous.encounterId === next.encounterId &&
    previous.serverInstanceId === next.serverInstanceId &&
    previous.serverStartedAt === next.serverStartedAt &&
    next.revision > previous.revision &&
    next.acceptedHitCount > previous.acceptedHitCount,
  );
}

export function battleCountdownLabel(deadlineAt: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1000));
  if (seconds === 0) return "RESOLVING BATTLE";
  return `TIME ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function overlayBattleView(input: {
  connection: string;
  forgeFresh: boolean;
  battleFresh: boolean;
  forge: ForgeState | null;
  battle: OverlayBattleStateV1 | null;
}): OverlayBattleView {
  const { forge, battle } = input;
  if (input.connection !== "connected" || !input.forgeFresh || !input.battleFresh || !forge)
    return "unavailable";
  const twitchDisconnected = forge.mode === "twitch" && !forge.connectedToTwitch;
  if (forge.status === "idle") return "awaiting";
  if (forge.status === "voting") return twitchDisconnected ? "disconnected" : "voting";
  if (!battle?.forgeIdentity || !forge.cycleId) return "waiting-battle";
  const identity = battle.forgeIdentity;
  if (
    identity.serverInstanceId !== forge.serverInstanceId ||
    identity.serverStartedAt !== forge.serverStartedAt ||
    identity.mode !== forge.mode ||
    identity.cycleId !== forge.cycleId ||
    battle.forgeCycleId !== forge.cycleId
  )
    return twitchDisconnected ? "disconnected" : "waiting-battle";
  if (battle.status === "cancelled") return "cancelled";
  if (twitchDisconnected) return "disconnected";
  if (battle.status === "ready") return "ready";
  if (battle.status === "active") return "active";
  if (battle.status === "victory") return "victory";
  if (battle.status === "expired") return "expired";
  return "waiting-battle";
}
