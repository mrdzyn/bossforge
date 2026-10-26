import { describe, expect, it } from "vitest";
import {
  createCombatState,
  startCombat,
  stepCombat,
  type Boss,
  type CombatState,
} from "../src/index.js";

const boss: Boss = {
  id: "test-boss",
  name: "Ashen Golem",
  attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
  stats: { health: 240, damage: 18, attackIntervalMs: 1_500 },
};

function run(state: CombatState, input: Parameters<typeof stepCombat>[1], time: number) {
  return stepCombat(state, input, time);
}

describe("deterministic local combat", () => {
  it("uses the exact forged stats and makes the winning weakness actionable", () => {
    expect(createCombatState(boss).bossHealth).toBe(boss.stats.health);
    const shoot = (ammo: "water" | "earth") => {
      let state = startCombat(createCombatState(boss));
      state = run(state, { attackPressed: true, aimX: state.bossX, aimY: state.bossY, ammo }, 16);
      return state.projectiles[0]?.damage;
    };
    expect(shoot("water")).toBe(21);
    expect(shoot("earth")).toBe(12);
    let state = startCombat(createCombatState(boss));
    for (let index = 0; index < 20; index += 1) {
      state = run(state, { attackPressed: true, aimX: state.bossX, aimY: state.bossY }, 100);
      state = run(state, {}, 100);
      state = run(state, {}, 100);
      state = run(state, {}, 100);
      state = run(state, {}, 100);
    }
    expect(state.bossHealth).toBeLessThan(240);
    expect(state.bossHealth).toBeGreaterThanOrEqual(0);
  });

  it("telegraphs and deterministically releases each selected special", () => {
    for (const special of ["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"] as const) {
      const selectedBoss = { ...boss, attributes: { ...boss.attributes, special } };
      let state = startCombat(createCombatState(selectedBoss));
      for (let index = 0; index < 16; index += 1) state = run(state, {}, 100);
      expect(state.attack?.phase).toBe("telegraph");
      expect(state.attack.pattern).toBe(special);
      for (let index = 0; index < 12 && state.attack?.phase !== "active"; index += 1)
        state = run(state, {}, 100);
      expect(state.attack?.phase).toBe("active");
      expect(state.attack.pattern).toBe(special);
      if (special === "thunder-dash") state = run(state, {}, 100);
      if (special === "ember-burst" || special === "frost-chain")
        expect(state.projectiles.some((projectile) => projectile.owner === "boss")).toBe(true);
      if (special === "thunder-dash") expect(state.bossX !== 480 || state.bossY !== 172).toBe(true);
    }
  });

  it("allows a dodge only off cooldown and grants timed invulnerability", () => {
    let state = startCombat(createCombatState(boss));
    const startX = state.playerX;
    state = run(state, { moveX: 1, dodgePressed: true }, 100);
    expect(state.playerX).toBeGreaterThan(startX);
    expect(state.dodgeCooldownMs).toBeGreaterThan(0);
    const dodgeAgain = run(state, { moveX: -1, dodgePressed: true }, 50);
    expect(dodgeAgain.dodgeCooldownMs).toBeLessThan(state.dodgeCooldownMs);
    expect(dodgeAgain.playerInvulnerabilityMs).toBeGreaterThan(0);
  });

  it("resolves real hits, victory and defeat without changing terminal state", () => {
    let state = startCombat(createCombatState(boss));
    state = { ...state, bossHealth: 1 };
    state = run(
      state,
      { attackPressed: true, aimX: state.bossX, aimY: state.bossY, ammo: "water" },
      100,
    );
    for (let i = 0; i < 5 && state.status === "active"; i += 1) state = run(state, {}, 100);
    expect(state.status).toBe("streamer-won");
    expect(stepCombat(state, { moveX: 1 }, 100)).toBe(state);

    let defeated = startCombat(
      createCombatState({ ...boss, attributes: { ...boss.attributes, special: "frost-chain" } }),
    );
    defeated = { ...defeated, playerHealth: 1, attackCooldownMs: 0 };
    for (let i = 0; i < 100 && defeated.status === "active"; i += 1)
      defeated = run(defeated, {}, 100);
    expect(defeated.status).toBe("community-won");
  });
});
