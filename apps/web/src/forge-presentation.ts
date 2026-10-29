import {
  RevealedForgeStateSchema,
  type ForgeState,
  type RevealedForgeState,
} from "@bossforge/shared";

const FORGE_CATEGORIES = ["body", "element", "special", "weakness"] as const;

/** Accept a reveal only when the fresh server snapshot contains all four closed outcomes. */
export function authoritativeReveal(state: ForgeState | null): RevealedForgeState | null {
  const parsed = RevealedForgeStateSchema.safeParse(state);
  if (!parsed.success) return null;

  const reveal = parsed.data;
  const complete = reveal.categories.every(
    (category, index) =>
      category.category === FORGE_CATEGORIES[index] &&
      category.status === "closed" &&
      category.winner !== null &&
      category.options.some((option) => option.choice === category.winner),
  );
  return complete ? reveal : null;
}

/** Invalid reveal-shaped snapshots are never rendered as current forge state. */
export function currentForgePresentation(state: ForgeState | null): ForgeState | null {
  if (!state) return null;
  return state.status === "revealed" ? authoritativeReveal(state) : state;
}
