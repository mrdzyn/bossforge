import {
  FORGE_VOTE_CHOICES,
  ForgeStateSchema,
  parseVoteCommand,
  type BossAttributes,
  type ForgeCategoryState,
  type ForgeState,
  type NormalizedChatEvent,
  type VoteCategory,
} from "@bossforge/shared";
import { assembleBoss } from "./boss-assembly.js";

const categories: VoteCategory[] = ["body", "element", "special", "weakness"];
const validViewerId = /^[\p{L}\p{N}_.:@-]{1,64}$/u;

export interface ForgeScheduler {
  schedule(callback: () => void, delayMs: number): () => void;
}

const realScheduler: ForgeScheduler = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

type Ballot = { viewerId: string; choice: string };

export class ForgeSession {
  private revision = 0;
  private cycleNumber = 0;
  private cycleId: string | null = null;
  private status: ForgeState["status"] = "idle";
  private durationSeconds = 15;
  private startedAt: Date | null = null;
  private activeIndex = -1;
  private openedAt: Date | null = null;
  private closesAt: Date | null = null;
  private winners: Partial<Record<VoteCategory, { choice: string; fallback: boolean }>> = {};
  private stageTimes: Partial<Record<VoteCategory, { openedAt: string; closesAt: string }>> = {};
  private ballots: Record<VoteCategory, Map<string, Ballot>> = this.newBallots();
  private seenMessageIds = new Set<string>();
  private cancelTimer: (() => void) | undefined;
  private boss: ForgeState["boss"] = null;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly scheduler: ForgeScheduler = realScheduler,
    private readonly onChange: (state: ForgeState) => void = () => undefined,
  ) {}

  start(durationSeconds = 15): ForgeState {
    this.syncTime();
    if (this.status !== "idle") throw new Error("A forge cycle is already active");
    if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 60) {
      throw new Error("Vote duration must be between 5 and 60 seconds");
    }
    this.cycleNumber += 1;
    this.cycleId = `forge-${this.cycleNumber}`;
    this.status = "voting";
    this.durationSeconds = durationSeconds;
    this.startedAt = this.now();
    this.activeIndex = 0;
    this.winners = {};
    this.stageTimes = {};
    this.ballots = this.newBallots();
    this.boss = null;
    this.openCategory();
    return this.changed();
  }

  reset(): ForgeState {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    this.status = "idle";
    this.cycleId = null;
    this.startedAt = null;
    this.activeIndex = -1;
    this.openedAt = null;
    this.closesAt = null;
    this.winners = {};
    this.stageTimes = {};
    this.ballots = this.newBallots();
    this.boss = null;
    return this.changed();
  }

  handleEvent(event: NormalizedChatEvent): boolean {
    if (event.kind !== "chat.message" || event.provider !== "mock") return false;
    const { message } = event;
    if (this.seenMessageIds.has(message.id)) return false;
    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size > 4096) {
      const oldest = this.seenMessageIds.values().next().value as string | undefined;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
    if (this.status !== "voting") return false;
    this.syncTime();
    if (this.status !== "voting" || !this.closesAt || !this.openedAt) return false;
    const occurredAt = Date.parse(message.occurredAt);
    const now = this.now().getTime();
    if (
      !Number.isFinite(occurredAt) ||
      occurredAt < this.openedAt.getTime() ||
      occurredAt > now ||
      occurredAt >= this.closesAt.getTime()
    )
      return false;
    if (!validViewerId.test(message.viewer.id)) return false;
    const command = parseVoteCommand(message.text);
    if (!command || command.category !== categories[this.activeIndex]) return false;
    const choices = FORGE_VOTE_CHOICES[command.category] as readonly string[];
    if (!choices.includes(command.choice.toLowerCase())) return false;
    const choice = command.choice.toLowerCase();
    const ballots = this.ballots[command.category];
    if (ballots.get(message.viewer.id)?.choice === choice) return false;
    ballots.set(message.viewer.id, { viewerId: message.viewer.id, choice });
    this.changed();
    return true;
  }

  getState(): ForgeState {
    this.syncTime();
    return this.buildState();
  }

  private buildState(): ForgeState {
    const categoryStates = categories.map((category, index): ForgeCategoryState => {
      const choices = FORGE_VOTE_CHOICES[category] as readonly string[];
      const ballots = [...this.ballots[category].values()];
      const counts = new Map(choices.map((choice) => [choice, 0]));
      for (const ballot of ballots) counts.set(ballot.choice, (counts.get(ballot.choice) ?? 0) + 1);
      const totalVotes = ballots.length;
      const winner = this.winners[category];
      return {
        category,
        status:
          this.status === "idle" || index > this.activeIndex
            ? "pending"
            : index < this.activeIndex || this.status === "revealed"
              ? "closed"
              : "open",
        options: choices.map((choice) => ({
          choice,
          count: counts.get(choice) ?? 0,
          percentage: totalVotes ? Math.round(((counts.get(choice) ?? 0) * 100) / totalVotes) : 0,
        })),
        totalVotes,
        openedAt: this.stageTimes[category]?.openedAt ?? null,
        closesAt: this.stageTimes[category]?.closesAt ?? null,
        winner: winner?.choice ?? null,
        noVoteFallback: winner?.fallback ?? false,
      };
    });
    return ForgeStateSchema.parse({
      revision: this.revision,
      cycleId: this.cycleId,
      status: this.status,
      simulated: true,
      connectedToTwitch: false,
      durationSeconds: this.durationSeconds,
      startedAt: this.startedAt?.toISOString() ?? null,
      activeCategory: this.status === "voting" ? categories[this.activeIndex] : null,
      progress:
        this.status === "revealed" ? 4 : this.status === "voting" ? this.activeIndex + 1 : 0,
      categories: categoryStates,
      boss: this.boss,
    });
  }

  close(): void {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }

  private syncTime(): void {
    if (
      this.status === "voting" &&
      this.closesAt &&
      this.now().getTime() >= this.closesAt.getTime()
    )
      this.closeCategory();
  }

  private openCategory(): void {
    this.cancelTimer?.();
    this.openedAt = this.now();
    this.closesAt = new Date(this.openedAt.getTime() + this.durationSeconds * 1000);
    const category = categories[this.activeIndex];
    if (category) {
      this.stageTimes[category] = {
        openedAt: this.openedAt.toISOString(),
        closesAt: this.closesAt.toISOString(),
      };
    }
    this.cancelTimer = this.scheduler.schedule(
      () => this.closeCategory(),
      this.durationSeconds * 1000,
    );
  }

  private closeCategory(): void {
    if (this.status !== "voting") return;
    const category = categories[this.activeIndex];
    if (!category) return;
    const choices = FORGE_VOTE_CHOICES[category] as readonly string[];
    const counts = new Map(choices.map((choice) => [choice, 0]));
    for (const ballot of this.ballots[category].values())
      counts.set(ballot.choice, (counts.get(ballot.choice) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const fallback = max === 0;
    const choice = fallback
      ? choices[0]!
      : choices.find((candidate) => counts.get(candidate) === max)!;
    this.winners[category] = { choice, fallback };
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    if (this.activeIndex === categories.length - 1) {
      this.status = "revealed";
      const attributes = Object.fromEntries(
        categories.map((item) => [item, this.winners[item]?.choice]),
      ) as BossAttributes;
      this.boss = assembleBoss(attributes, this.cycleId ?? "forge");
    } else {
      this.activeIndex += 1;
      this.openCategory();
    }
    this.changed();
  }

  private changed(): ForgeState {
    this.revision += 1;
    const state = this.buildState();
    this.onChange(state);
    return state;
  }

  private newBallots(): Record<VoteCategory, Map<string, Ballot>> {
    return { body: new Map(), element: new Map(), special: new Map(), weakness: new Map() };
  }
}
