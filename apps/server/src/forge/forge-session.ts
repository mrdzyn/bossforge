import { randomUUID } from "node:crypto";
import {
  FORGE_VOTE_CHOICES,
  ForgeStateSchema,
  parseVoteCommand,
  type BossAttributes,
  type ForgeCategoryState,
  type ForgeState,
  type Provider,
  type VoteCategory,
} from "@bossforge/shared";
import type { NormalizedChatEvent } from "../events/normalized-chat-event.js";
import { assembleBoss } from "./boss-assembly.js";
import type { ForgeBallotReason } from "../twitch/eventsub-diagnostics.js";

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
  private weaknessRetry = false;
  private timerGeneration = 0;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly scheduler: ForgeScheduler = realScheduler,
    private readonly onChange: (state: ForgeState) => void = () => undefined,
    private readonly serverInstanceId: string = randomUUID(),
    private readonly serverStartedAt: string = new Date().toISOString(),
    private readonly mode: Provider = "mock",
    private connectedToTwitch = false,
    private readonly onBallotResult?: (reason: ForgeBallotReason) => void,
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
    this.weaknessRetry = false;
    this.openCategory();
    return this.changed();
  }

  reset(): ForgeState {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    this.timerGeneration += 1;
    this.weaknessRetry = false;
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
    if (event.kind !== "chat.message") return this.rejectBallot("wrong-event");
    if (event.provider !== this.mode) return this.rejectBallot("wrong-provider");
    if (this.mode === "twitch" && !this.connectedToTwitch) return this.rejectBallot("disconnected");
    const { message } = event;
    if (this.seenMessageIds.has(message.id)) return this.rejectBallot("duplicate-message");
    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size > 4096) {
      const oldest = this.seenMessageIds.values().next().value as string | undefined;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
    if (this.status !== "voting") return this.rejectBallot("inactive-voting");
    this.syncTime();
    if (this.status !== "voting" || !this.closesAt || !this.openedAt)
      return this.rejectBallot("inactive-voting");
    const occurredAt = Date.parse(message.occurredAt);
    const now = this.now().getTime();
    if (!Number.isFinite(occurredAt)) return this.rejectBallot("invalid-timestamp");
    if (
      occurredAt < this.openedAt.getTime() ||
      occurredAt > now ||
      occurredAt >= this.closesAt.getTime()
    )
      return this.rejectBallot("late-or-future-timestamp");
    if (!validViewerId.test(message.viewer.id)) return this.rejectBallot("invalid-viewer");
    const command = parseVoteCommand(message.text);
    if (!command) return this.rejectBallot("invalid-choice");
    if (command.category !== categories[this.activeIndex])
      return this.rejectBallot("wrong-category");
    const choices = FORGE_VOTE_CHOICES[command.category] as readonly string[];
    if (!choices.includes(command.choice.toLowerCase())) return this.rejectBallot("invalid-choice");
    const choice = command.choice.toLowerCase();
    const ballots = this.ballots[command.category];
    if (ballots.get(message.viewer.id)?.choice === choice)
      return this.rejectBallot("unchanged-choice");
    ballots.set(message.viewer.id, { viewerId: message.viewer.id, choice });
    this.onBallotResult?.("accepted");
    this.changed();
    return true;
  }

  getState(): ForgeState {
    this.syncTime();
    return this.buildState();
  }

  setTwitchConnected(connected: boolean): ForgeState {
    if (this.mode !== "twitch" || this.connectedToTwitch === connected) return this.buildState();
    this.connectedToTwitch = connected;
    if (!connected && this.status === "voting") this.reset();
    return this.changed();
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
            : index < this.activeIndex || this.status === "revealed" || this.status === "failed"
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
      serverInstanceId: this.serverInstanceId,
      serverStartedAt: this.serverStartedAt,
      revision: this.revision,
      cycleId: this.cycleId,
      status: this.status,
      mode: this.mode,
      simulated: this.mode === "mock",
      connectedToTwitch: this.mode === "twitch" && this.connectedToTwitch,
      durationSeconds: this.durationSeconds,
      startedAt: this.startedAt?.toISOString() ?? null,
      activeCategory: this.status === "voting" ? categories[this.activeIndex] : null,
      weaknessRetry: this.weaknessRetry,
      progress:
        this.status === "revealed"
          ? 4
          : this.status === "failed"
            ? 3
            : this.status === "voting"
              ? this.activeIndex + 1
              : 0,
      categories: categoryStates,
      boss: this.boss,
    });
  }

  close(): void {
    this.timerGeneration += 1;
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
    const generation = ++this.timerGeneration;
    this.cancelTimer = this.scheduler.schedule(() => {
      if (generation === this.timerGeneration) this.closeCategory();
    }, this.durationSeconds * 1000);
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
    if (category === "weakness" && fallback) {
      this.cancelTimer?.();
      this.cancelTimer = undefined;
      this.timerGeneration += 1;
      if (!this.weaknessRetry) {
        this.weaknessRetry = true;
        this.openCategory();
      } else {
        this.status = "failed";
        this.openedAt = null;
        this.closesAt = null;
      }
      this.changed();
      return;
    }
    const choice = fallback
      ? choices[0]!
      : choices.find((candidate) => counts.get(candidate) === max)!;
    this.winners[category] = { choice, fallback };
    this.cancelTimer?.();
    this.cancelTimer = undefined;
    this.timerGeneration += 1;
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

  private rejectBallot(reason: Exclude<ForgeBallotReason, "accepted">): false {
    this.onBallotResult?.(reason);
    return false;
  }

  private newBallots(): Record<VoteCategory, Map<string, Ballot>> {
    return { body: new Map(), element: new Map(), special: new Map(), weakness: new Map() };
  }
}
