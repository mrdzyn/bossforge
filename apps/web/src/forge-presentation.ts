import {
  authoritativeCompletedReveal,
  type ForgeState,
  type RevealedForgeState,
} from "@bossforge/shared";

/** Accept a reveal only when the fresh server snapshot contains all four closed outcomes. */
export function authoritativeReveal(state: ForgeState | null): RevealedForgeState | null {
  return authoritativeCompletedReveal(state);
}

/** Invalid reveal-shaped snapshots are never rendered as current forge state. */
export function currentForgePresentation(state: ForgeState | null): ForgeState | null {
  if (!state) return null;
  return state.status === "revealed" ? authoritativeReveal(state) : state;
}
