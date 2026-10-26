import { describe, expect, it } from "vitest";
import { RevealedForgeStateSchema, type ForgeState } from "../src/index.js";

const makeState = (status: ForgeState["status"]): ForgeState => ({
  serverInstanceId: "process-1",
  serverStartedAt: "2026-10-26T12:00:00.000Z",
  revision: 8,
  cycleId: status === "idle" ? null : "cycle-1",
  status,
  simulated: true,
  connectedToTwitch: false,
  durationSeconds: 15,
  startedAt: status === "idle" ? null : "2026-10-26T12:00:00.000Z",
  activeCategory: status === "voting" ? "body" : null,
  progress: status === "revealed" ? 4 : status === "voting" ? 1 : 0,
  categories: (["body", "element", "special", "weakness"] as const).map((category) => ({
    category,
    status: status === "idle" ? "pending" : "closed",
    options: ["first", "second"].map((choice) => ({ choice, count: 0, percentage: 0 })),
    totalVotes: 0,
    openedAt: null,
    closesAt: null,
    winner: status === "revealed" ? "first" : null,
    noVoteFallback: status === "revealed",
  })),
  boss:
    status === "revealed"
      ? {
          id: "boss-1",
          name: "Ashen Golem",
          attributes: {
            body: "golem",
            element: "fire",
            special: "ember-burst",
            weakness: "water",
          },
          stats: { health: 120, damage: 12, attackIntervalMs: 1_800 },
        }
      : null,
});

describe("revealed arena snapshot contract", () => {
  it("accepts a complete revealed forge state with its authoritative boss", () => {
    expect(RevealedForgeStateSchema.parse(makeState("revealed")).boss.id).toBe("boss-1");
  });

  it.each(["idle", "voting"] as const)("rejects the %s state", (status) => {
    expect(RevealedForgeStateSchema.safeParse(makeState(status)).success).toBe(false);
  });
});
