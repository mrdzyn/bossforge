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

function playSpecial(special: Boss["attributes"]["special"], evade: boolean): CombatState {
  const selectedBoss = { ...boss, attributes: { ...boss.attributes, special } };
  let state = startCombat(createCombatState(selectedBoss));
  let hasTelegraphed = false;
  let hasActivated = false;
  let evaded = false;
  let finishedAt: number | null = null;
  for (let tick = 0; tick < 180 && state.status === "active"; tick += 1) {
    const attack = state.attack;
    let input: Parameters<typeof stepCombat>[1] = {};
    if (attack?.phase === "telegraph") {
      hasTelegraphed = true;
      if (evade && special !== "shadow-pulse") {
        input = { moveX: 1, dodgePressed: !evaded };
        evaded = true;
      }
    } else if (evade && special === "shadow-pulse" && attack?.phase === "active") {
      hasActivated = true;
      if (!evaded && attack.elapsedMs >= 400) {
        input = { moveX: 1, dodgePressed: true };
        evaded = true;
      }
    }
    if (attack?.phase === "active") hasActivated = true;
    state = run(state, input, 50);
    if (hasActivated && state.attack === null && finishedAt === null) finishedAt = state.elapsedMs;
    if (finishedAt !== null && state.elapsedMs - finishedAt >= 1_400) break;
    if (!evade && state.playerHealth < PLAYER_HEALTH) break;
  }
  expect(hasTelegraphed).toBe(true);
  expect(hasActivated).toBe(true);
  if (evade) expect(evaded).toBe(true);
  return state;
}

const PLAYER_HEALTH = 100;

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

  it.each(["ember-burst", "frost-chain", "thunder-dash", "shadow-pulse"] as const)(
    "%s threatens a stationary default-spawn player and can be evaded",
    (special) => {
      const stationary = playSpecial(special, false);
      expect(stationary.playerHealth).toBeLessThan(PLAYER_HEALTH);

      const evasive = playSpecial(special, true);
      expect(evasive.playerHealth).toBe(PLAYER_HEALTH);
    },
  );

  it.each([
    { ammo: "water" as const, feedback: "weakness" as const },
    { ammo: "earth" as const, feedback: "normal" as const },
  ])("records $feedback feedback only after a real player hit", ({ ammo, feedback }) => {
    let state = startCombat(createCombatState(boss));
    state = run(state, { attackPressed: true, aimX: state.bossX, aimY: state.bossY, ammo }, 50);
    expect(state.lastBossHitFeedback).toBeNull();
    for (let index = 0; index < 6 && state.lastBossHitFeedback === null; index += 1)
      state = run(state, {}, 100);
    expect(state.lastBossHitFeedback).toBe(feedback);
    expect(state.lastBossHitMs).toBeGreaterThan(0);
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
