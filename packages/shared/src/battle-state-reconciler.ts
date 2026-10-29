import type { CommunityBattleStateV1 } from "./battle.js";

/** Battle snapshots have their own epoch/encounter rules, separate from ForgeState. */
export class BattleStateReconciler {
  private generation = 0;
  private current: CommunityBattleStateV1 | null = null;
  private available = false;
  private readonly retiredEncounters = new Set<string>();
  private snapshotGeneration: number | null = null;

  beginConnection(): number {
    this.generation += 1;
    this.available = false;
    this.snapshotGeneration = null;
    return this.generation;
  }
  get connectionGeneration(): number {
    return this.generation;
  }
  get state(): CommunityBattleStateV1 | null {
    return this.available ? this.current : null;
  }
  get hasFreshState(): boolean {
    return this.available && this.current !== null;
  }
  invalidate(): void {
    this.available = false;
    this.snapshotGeneration = null;
  }

  apply(
    state: CommunityBattleStateV1,
    generation: number,
    source: "snapshot" | "mutation" | "websocket",
  ): boolean {
    if (generation !== this.generation) return false;
    if (state.encounterId && this.retiredEncounters.has(state.encounterId)) return false;
    if (source !== "snapshot" && this.snapshotGeneration !== generation) return false;
    if (!this.current) {
      if (source !== "snapshot") return false;
      this.current = state;
      this.snapshotGeneration = generation;
      this.available = true;
      return true;
    }
    const sameEpoch =
      state.serverInstanceId === this.current.serverInstanceId &&
      state.serverStartedAt === this.current.serverStartedAt;
    if (!sameEpoch) {
      if (
        source !== "snapshot" ||
        Date.parse(state.serverStartedAt) <= Date.parse(this.current.serverStartedAt)
      )
        return false;
      if (this.current.encounterId) this.retire(this.current.encounterId);
      this.current = state;
      this.snapshotGeneration = generation;
      this.available = true;
      return true;
    }
    if (state.revision < this.current.revision) return false;
    if (state.revision === this.current.revision) {
      if (JSON.stringify(state) !== JSON.stringify(this.current)) return false;
      if (source === "snapshot") this.snapshotGeneration = generation;
      this.available = true;
      return true;
    }
    if (state.encounterId !== this.current.encounterId && this.current.encounterId)
      this.retire(this.current.encounterId);
    this.current = state;
    if (source === "snapshot") this.snapshotGeneration = generation;
    this.available = true;
    return true;
  }
  private retire(id: string): void {
    this.retiredEncounters.add(id);
    if (this.retiredEncounters.size > 256)
      this.retiredEncounters.delete(this.retiredEncounters.values().next().value!);
  }
}
