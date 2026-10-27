import type { ForgeState } from "@bossforge/shared";

export const FORGE_DURATIONS = [15, 30, 60] as const;
export type ForgeDuration = (typeof FORGE_DURATIONS)[number];

export function isTwitchVoteCancelled(previous: ForgeState | null, next: ForgeState): boolean {
  return (
    previous?.mode === "twitch" &&
    previous.connectedToTwitch &&
    previous.status === "voting" &&
    next.mode === "twitch" &&
    !next.connectedToTwitch &&
    next.status === "idle"
  );
}

export function sanitizedForgeStartError(status: number, serverError?: unknown): string {
  const safeError = typeof serverError === "string" ? serverError : "";
  if (status === 401) return "Your local Twitch owner session is unavailable. Reconnect Twitch.";
  if (status === 403)
    return "The local request was blocked. Open BossForge at http://localhost:5173 and try again.";
  if (status === 409 && safeError === "Twitch EventSub is not connected")
    return "Twitch is disconnected. Reconnect Twitch before starting a live forge.";
  if (status === 409 && safeError === "A forge cycle is already active")
    return "A forge cycle is already active. Wait for it to finish or reset it.";
  if (status === 400) return "The forge duration is invalid. Choose 15, 30, or 60 seconds.";
  if (status === 429) return "Too many local requests. Wait a moment and try again.";
  return `The forge request failed (HTTP ${status}). Try again or check the local server.`;
}

export function forgeCountdownLabel(category: string, seconds: number): string {
  return `${category.replaceAll("-", " ").toUpperCase()} · ${seconds}s`;
}
