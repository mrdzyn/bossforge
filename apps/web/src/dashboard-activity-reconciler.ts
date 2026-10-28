import type { DashboardActivity, ForgeState } from "@bossforge/shared";

function matchesState(activity: DashboardActivity, state: ForgeState): boolean {
  return activity.serverInstanceId === state.serverInstanceId && activity.cycleId === state.cycleId;
}

/** Keeps dashboard aggregates within the live feed generation and state epoch. */
export class DashboardActivityReconciler {
  private generation = 0;
  private transportReady = false;
  private stateIsFresh = false;
  private state: ForgeState | null = null;
  private currentActivity: DashboardActivity | null = null;
  private pendingActivity: DashboardActivity | null = null;

  beginConnection(): number {
    this.generation += 1;
    this.transportReady = false;
    this.reset();
    return this.generation;
  }

  setTransportReady(generation: number, ready: boolean): boolean {
    if (generation !== this.generation) return false;
    this.transportReady = ready;
    if (!ready) this.reset();
    return true;
  }

  applyForgeState(state: ForgeState, generation: number): boolean {
    if (generation !== this.generation || !this.transportReady) return false;
    this.state = state;
    this.stateIsFresh = true;
    const candidate = this.pendingActivity ?? this.currentActivity;
    this.pendingActivity = null;
    this.currentActivity = candidate && matchesState(candidate, state) ? candidate : null;
    return true;
  }

  applyActivity(activity: DashboardActivity, generation: number): boolean {
    if (generation !== this.generation || !this.transportReady) return false;
    if (!this.stateIsFresh || !this.state) {
      this.pendingActivity = activity;
      return true;
    }
    if (!matchesState(activity, this.state)) return false;
    this.currentActivity = activity;
    return true;
  }

  getActivity(
    generation: number,
    connected: boolean,
    snapshotAvailable: boolean,
  ): DashboardActivity | null {
    if (
      generation !== this.generation ||
      !this.transportReady ||
      !this.stateIsFresh ||
      !connected ||
      !snapshotAvailable ||
      !this.currentActivity ||
      !this.state ||
      !matchesState(this.currentActivity, this.state)
    )
      return null;
    return this.currentActivity;
  }

  private reset(): void {
    this.stateIsFresh = false;
    this.state = null;
    this.currentActivity = null;
    this.pendingActivity = null;
  }
}
