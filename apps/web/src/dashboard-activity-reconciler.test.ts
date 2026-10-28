import type { DashboardActivity, ForgeState } from "@bossforge/shared";
import { describe, expect, it } from "vitest";
import { DashboardActivityReconciler } from "./dashboard-activity-reconciler.js";

const state = (serverInstanceId: string, cycleId: string | null): ForgeState =>
  ({ serverInstanceId, cycleId }) as ForgeState;

const activity = (
  serverInstanceId: string,
  cycleId: string | null,
  accepted: number,
): DashboardActivity => ({
  serverInstanceId,
  cycleId,
  accepted,
  rejected: 1,
  reasons: { invalid: 1, duplicate: 0, inactive: 0, other: 0 },
});

describe("DashboardActivityReconciler", () => {
  it("hides aggregates immediately on feed loss and requires fresh state and activity after reconnect", () => {
    const reconciler = new DashboardActivityReconciler();
    const first = reconciler.beginConnection();
    reconciler.setTransportReady(first, true);
    reconciler.applyForgeState(state("server-a", "cycle-a"), first);
    reconciler.applyActivity(activity("server-a", "cycle-a", 3), first);
    expect(reconciler.getActivity(first, true, true)?.accepted).toBe(3);

    reconciler.setTransportReady(first, false);
    expect(reconciler.getActivity(first, false, false)).toBeNull();
    expect(reconciler.applyActivity(activity("server-a", "cycle-a", 4), first)).toBe(false);

    const second = reconciler.beginConnection();
    expect(reconciler.applyActivity(activity("server-a", "cycle-a", 99), second)).toBe(false);
    reconciler.setTransportReady(second, true);
    expect(reconciler.getActivity(second, true, false)).toBeNull();
    expect(reconciler.applyActivity(activity("server-a", "cycle-a", 4), first)).toBe(false);
    reconciler.applyForgeState(state("server-a", "cycle-a"), second);
    expect(reconciler.getActivity(second, true, true)).toBeNull();
    reconciler.applyActivity(activity("server-a", "cycle-a", 5), second);
    expect(reconciler.getActivity(second, true, true)?.accepted).toBe(5);
  });

  it("buffers initial activity until authoritative state for the same server and cycle arrives", () => {
    const reconciler = new DashboardActivityReconciler();
    const generation = reconciler.beginConnection();
    reconciler.setTransportReady(generation, true);
    expect(reconciler.applyActivity(activity("server-a", "cycle-a", 2), generation)).toBe(true);
    expect(reconciler.getActivity(generation, true, true)).toBeNull();
    reconciler.applyForgeState(state("server-a", "cycle-a"), generation);
    expect(reconciler.getActivity(generation, true, true)?.accepted).toBe(2);
  });

  it("rejects old process and old cycle aggregates after a fresh forge state", () => {
    const reconciler = new DashboardActivityReconciler();
    const generation = reconciler.beginConnection();
    reconciler.setTransportReady(generation, true);
    reconciler.applyForgeState(state("server-new", "cycle-new"), generation);
    expect(reconciler.applyActivity(activity("server-old", "cycle-new", 90), generation)).toBe(
      false,
    );
    expect(reconciler.applyActivity(activity("server-new", "cycle-old", 80), generation)).toBe(
      false,
    );
    expect(reconciler.getActivity(generation, true, true)).toBeNull();
  });
});
