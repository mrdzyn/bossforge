export type HitElement = "water" | "light" | "earth" | "wind";
export type HitCommand = { element: HitElement | null };

const hitGrammar = /^!hit(?: (water|light|earth|wind))?$/;

/** Small, anchored grammar. No trimming or multiline normalization is intentional. */
export function parseHitCommand(text: string): HitCommand | undefined {
  if (text.length > 32 || /[\p{Cc}<>]/u.test(text)) return undefined;
  const match = hitGrammar.exec(text);
  if (!match) return undefined;
  return { element: (match[1] as HitElement | undefined) ?? null };
}
