import type { ForgeState } from "./index.js";

/** Applies state only from the current transport generation and newest server revision. */
export class ForgeStateReconciler {
  private generation = 0;
  private current: ForgeState | null = null;

  beginConnection(): number {
    this.generation += 1;
    return this.generation;
  }

  get connectionGeneration(): number {
    return this.generation;
  }

  get state(): ForgeState | null {
    return this.current;
  }

  apply(state: ForgeState, generation: number): boolean {
    if (generation !== this.generation) return false;
    if (this.current) {
      if (state.serverInstanceId === this.current.serverInstanceId) {
        if (state.revision < this.current.revision) return false;
      } else if (Date.parse(state.serverStartedAt) <= Date.parse(this.current.serverStartedAt)) {
        return false;
      }
    }
    this.current = state;
    return true;
  }
}
