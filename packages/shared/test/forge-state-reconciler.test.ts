import { describe, expect, it } from "vitest";
import { ForgeStateSchema } from "../src/index.js";
import { ForgeStateReconciler } from "../src/forge-state-reconciler.js";

const state = (
  serverInstanceId: string,
  revision: number,
  status: "idle" | "voting" | "revealed",
  activeCategory: "body" | "element" | "special" | "weakness" = "body",
) =>
  ForgeStateSchema.parse({
    serverInstanceId,
    serverStartedAt:
      serverInstanceId === "old-process"
        ? "2026-10-26T12:00:00.000Z"
        : serverInstanceId === "new-process"
          ? "2026-10-26T12:01:00.000Z"
          : "2026-10-26T12:00:00.000Z",
    revision,
    cycleId: status === "idle" ? null : `${serverInstanceId}-cycle`,
    status,
    simulated: true,
    connectedToTwitch: false,
    durationSeconds: 15,
    startedAt: status === "idle" ? null : "2026-10-26T12:00:00.000Z",
    activeCategory: status === "voting" ? activeCategory : null,
    progress: status === "revealed" ? 4 : status === "voting" ? 1 : 0,
    categories: ["body", "element", "special", "weakness"].map((category) => ({
      category,
      status:
        status === "idle"
          ? "pending"
          : category === "body" && status === "voting"
            ? "open"
            : "closed",
      options: ["a", "b"].map((choice) => ({ choice, count: 0, percentage: 0 })),
      totalVotes: 0,
      openedAt: null,
      closesAt: null,
      winner: status === "revealed" ? "a" : null,
      noVoteFallback: status === "revealed",
    })),
    boss:
      status === "revealed"
        ? {
            id: "old-process-boss",
            name: "Old Process Boss",
            attributes: {
              body: "golem",
              element: "fire",
              special: "ember-burst",
              weakness: "water",
            },
            stats: { health: 100, damage: 10, attackIntervalMs: 1000 },
          }
        : null,
  });

describe("ForgeStateReconciler", () => {
  it("replaces an old revealed process state with the restarted server's revision-zero snapshot", () => {
    const dashboard = new ForgeStateReconciler();
    const obsOverlay = new ForgeStateReconciler();
    const oldDashboardConnection = dashboard.beginConnection();
    const oldOverlayConnection = obsOverlay.beginConnection();
    const revealed = state("old-process", 31, "revealed");
    expect(dashboard.apply(revealed, oldDashboardConnection)).toBe(true);
    expect(obsOverlay.apply(revealed, oldOverlayConnection)).toBe(true);

    const newDashboardConnection = dashboard.beginConnection();
    const newOverlayConnection = obsOverlay.beginConnection();
    const restartedIdle = state("new-process", 0, "idle");
    expect(dashboard.apply(restartedIdle, newDashboardConnection)).toBe(true);
    expect(obsOverlay.apply(restartedIdle, newOverlayConnection)).toBe(true);
    expect(dashboard.state).toMatchObject({ status: "idle", boss: null, revision: 0 });
    expect(obsOverlay.state).toMatchObject({ status: "idle", boss: null, revision: 0 });

    const newVoting = state("new-process", 1, "voting");
    expect(dashboard.apply(newVoting, newDashboardConnection)).toBe(true);
    expect(obsOverlay.apply(newVoting, newOverlayConnection)).toBe(true);
    expect(dashboard.state?.activeCategory).toBe("body");
    expect(obsOverlay.state?.activeCategory).toBe("body");
  });

  it("rejects delayed states from an earlier connection or an older revision in the same process", () => {
    const reconciler = new ForgeStateReconciler();
    const first = reconciler.beginConnection();
    expect(reconciler.apply(state("process", 2, "voting"), first)).toBe(true);
    const current = reconciler.beginConnection();
    expect(reconciler.apply(state("process", 3, "voting"), current)).toBe(true);
    expect(reconciler.apply(state("process", 2, "voting"), first)).toBe(false);
    expect(reconciler.apply(state("process", 2, "voting"), current)).toBe(false);
    expect(reconciler.state?.revision).toBe(3);
  });

  it("rejects a delayed response from the previous server epoch after a same-connection snapshot", () => {
    const reconciler = new ForgeStateReconciler();
    const connection = reconciler.beginConnection();
    expect(reconciler.apply(state("old-process", 31, "revealed"), connection)).toBe(true);
    expect(reconciler.apply(state("new-process", 0, "idle"), connection)).toBe(true);
    expect(reconciler.apply(state("old-process", 32, "revealed"), connection)).toBe(false);
    expect(reconciler.state).toMatchObject({
      serverInstanceId: "new-process",
      status: "idle",
      revision: 0,
      boss: null,
    });
  });

  it("keeps reset, start, category transitions, and delayed mutation responses in one freshness order", () => {
    const reconciler = new ForgeStateReconciler();
    const connection = reconciler.beginConnection();
    const delayedResetResponse = state("process", 2, "idle");
    expect(reconciler.apply(state("process", 3, "voting", "body"), connection)).toBe(true);
    expect(reconciler.apply(state("process", 4, "voting", "element"), connection)).toBe(true);
    expect(reconciler.apply(state("process", 5, "voting", "special"), connection)).toBe(true);
    expect(reconciler.apply(state("process", 6, "voting", "weakness"), connection)).toBe(true);
    expect(reconciler.apply(state("process", 7, "idle"), connection)).toBe(true);
    expect(reconciler.apply(state("process", 8, "voting", "body"), connection)).toBe(true);
    expect(reconciler.apply(delayedResetResponse, connection)).toBe(false);
    expect(reconciler.state).toMatchObject({
      revision: 8,
      activeCategory: "body",
      status: "voting",
    });
  });
});
