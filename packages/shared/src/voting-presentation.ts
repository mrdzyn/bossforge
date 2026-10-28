import { FORGE_VOTE_CHOICES, type VoteCategory } from "./index.js";

export function humanizeVoteChoice(choice: string): string {
  return choice
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function voteCommand(category: VoteCategory, choice: string): string {
  return `!vote ${category} ${choice}`;
}

export function voteCommands(category: VoteCategory): string[] {
  return FORGE_VOTE_CHOICES[category].map((choice) => voteCommand(category, choice));
}

export function remainingVoteSeconds(closesAt: string | null, nowMs: number): number {
  if (!closesAt) return 0;
  const closeMs = Date.parse(closesAt);
  if (!Number.isFinite(closeMs)) return 0;
  return Math.max(0, Math.ceil((closeMs - nowMs) / 1000));
}

export function winnerAttribution(winner: string | null, usedDefault: boolean): string | null {
  if (!winner) return null;
  const label = humanizeVoteChoice(winner);
  return usedDefault
    ? `DEFAULT · No valid votes; ${label} was selected.`
    : `COMMUNITY VOTE · ${label} was selected.`;
}

export type CurrentVoteLeader =
  { status: "leader"; choice: string; count: number } | { status: "tied"; count: number };

export function currentVoteLeader(
  options: readonly { choice: string; count: number }[],
): CurrentVoteLeader | null {
  const count = Math.max(0, ...options.map((option) => option.count));
  if (count === 0) return null;
  const leaders = options.filter((option) => option.count === count);
  return leaders.length === 1
    ? { status: "leader", choice: leaders[0]!.choice, count }
    : { status: "tied", count };
}
