import type { Boss, BossAttributes } from "./index.js";

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 600;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_SHOT_COOLDOWN_MS = 420;
export const PLAYER_SHOT_DAMAGE = 12;
export const WEAKNESS_DAMAGE_MULTIPLIER = 1.75;
export const DODGE_COOLDOWN_MS = 1_350;
export const DODGE_DURATION_MS = 190;
export const DODGE_INVULNERABILITY_MS = 430;

export type AmmoElement = BossAttributes["weakness"];
export type CombatStatus = "ready" | "active" | "streamer-won" | "community-won";
export type SpecialPattern = BossAttributes["special"];
export type ProjectileOwner = "player" | "boss";

export interface CombatProjectile {
  id: number;
  owner: ProjectileOwner;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  damage: number;
  color: number;
}

export type BossAttackPhase = "telegraph" | "active";

export interface BossAttack {
  pattern: SpecialPattern;
  phase: BossAttackPhase;
  elapsedMs: number;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  safeAngle: number;
  shotCount: number;
  hitPlayer: boolean;
}

export interface CombatState {
  status: CombatStatus;
  elapsedMs: number;
  boss: Boss;
  bossX: number;
  bossY: number;
  bossHealth: number;
  playerX: number;
  playerY: number;
  playerHealth: number;
  playerInvulnerabilityMs: number;
  playerDodgeMs: number;
  dodgeCooldownMs: number;
  shotCooldownMs: number;
  selectedAmmo: AmmoElement;
  attackCooldownMs: number;
  attack: BossAttack | null;
  projectiles: CombatProjectile[];
  nextProjectileId: number;
  lastDamageMs: number;
  lastBossHitMs: number;
}

export interface CombatInput {
  moveX?: number;
  moveY?: number;
  dodgePressed?: boolean;
  attackPressed?: boolean;
  aimX?: number;
  aimY?: number;
  ammo?: AmmoElement;
}

const ELEMENT_COLORS: Record<BossAttributes["element"], number> = {
  fire: 0xff8b42,
  ice: 0x72d8ef,
  storm: 0xffd65e,
  void: 0xb58aff,
};

const AMMO_COLORS: Record<AmmoElement, number> = {
  water: 0x53c9ef,
  light: 0xffed9a,
  earth: 0xc69b68,
  wind: 0x94e2bd,
};

const PLAYER_SPEED = 205;
const DODGE_SPEED = 510;
const PLAYER_SHOT_SPEED = 690;
const BOSS_PROJECTILE_SPEED = 300;
const PLAYER_RADIUS = 18;
const BOSS_RADIUS: Record<BossAttributes["body"], number> = {
  golem: 47,
  wraith: 34,
  drake: 41,
  mimic: 39,
};

const BOSS_WINDUP_MS: Record<SpecialPattern, number> = {
  "ember-burst": 720,
  "frost-chain": 580,
  "thunder-dash": 680,
  "shadow-pulse": 700,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const magnitude = length(x, y);
  return magnitude === 0 ? { x: 0, y: 0 } : { x: x / magnitude, y: y / magnitude };
}

function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const x = x1 - x2;
  const y = y1 - y2;
  return x * x + y * y;
}

export function getBossElementColor(element: BossAttributes["element"]): number {
  return ELEMENT_COLORS[element];
}

export function getAmmoColor(ammo: AmmoElement): number {
  return AMMO_COLORS[ammo];
}

export function getBossCollisionRadius(body: BossAttributes["body"]): number {
  return BOSS_RADIUS[body];
}

export function createCombatState(boss: Boss): CombatState {
  return {
    status: "ready",
    elapsedMs: 0,
    boss,
    bossX: ARENA_WIDTH / 2,
    bossY: 172,
    bossHealth: boss.stats.health,
    playerX: ARENA_WIDTH / 2,
    playerY: ARENA_HEIGHT - 84,
    playerHealth: PLAYER_MAX_HEALTH,
    playerInvulnerabilityMs: 0,
    playerDodgeMs: 0,
    dodgeCooldownMs: 0,
    shotCooldownMs: 0,
    selectedAmmo: "water",
    attackCooldownMs: boss.stats.attackIntervalMs,
    attack: null,
    projectiles: [],
    nextProjectileId: 1,
    lastDamageMs: -Infinity,
    lastBossHitMs: -Infinity,
  };
}

export function startCombat(state: CombatState): CombatState {
  if (state.status !== "ready") return state;
  return { ...state, status: "active", elapsedMs: 0 };
}

function addProjectile(
  state: CombatState,
  owner: ProjectileOwner,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  speed: number,
  damage: number,
  radius: number,
  color: number,
): void {
  const direction = normalize(directionX, directionY);
  state.projectiles.push({
    id: state.nextProjectileId,
    owner,
    x,
    y,
    velocityX: direction.x * speed,
    velocityY: direction.y * speed,
    radius,
    damage,
    color,
  });
  state.nextProjectileId += 1;
}

function damagePlayer(state: CombatState, damage: number): void {
  if (state.playerInvulnerabilityMs > 0 || state.status !== "active") return;
  state.playerHealth = Math.max(0, state.playerHealth - Math.max(1, Math.round(damage)));
  state.playerInvulnerabilityMs = 300;
  state.lastDamageMs = state.elapsedMs;
}

function beginAttack(state: CombatState): BossAttack {
  const targetX = state.playerX;
  const targetY = state.playerY;
  const targetAngle = Math.atan2(targetY - state.bossY, targetX - state.bossX);
  return {
    pattern: state.boss.attributes.special,
    phase: "telegraph",
    elapsedMs: 0,
    originX: state.bossX,
    originY: state.bossY,
    targetX,
    targetY,
    targetAngle,
    safeAngle: targetAngle,
    shotCount: 0,
    hitPlayer: false,
  };
}

function releaseAttack(state: CombatState, attack: BossAttack): BossAttack {
  attack.phase = "active";
  attack.elapsedMs = 0;
  if (attack.pattern === "ember-burst") {
    const totalShots = 12;
    for (let index = 0; index < totalShots; index += 1) {
      const angle = (Math.PI * 2 * index) / totalShots;
      if (Math.abs(angleDelta(angle, attack.safeAngle)) < 0.48) continue;
      addProjectile(
        state,
        "boss",
        state.bossX,
        state.bossY,
        Math.cos(angle),
        Math.sin(angle),
        BOSS_PROJECTILE_SPEED,
        state.boss.stats.damage,
        10,
        ELEMENT_COLORS[state.boss.attributes.element],
      );
    }
    attack.shotCount = totalShots;
  }
  return attack;
}

function advanceBossAttack(state: CombatState, deltaMs: number): void {
  let attack = state.attack;
  if (!attack) {
    state.attackCooldownMs = Math.max(0, state.attackCooldownMs - deltaMs);
    if (state.attackCooldownMs === 0) state.attack = beginAttack(state);
    return;
  }

  attack.elapsedMs += deltaMs;
  if (attack.phase === "telegraph") {
    const windup = BOSS_WINDUP_MS[attack.pattern];
    if (attack.elapsedMs < windup) return;
    attack = releaseAttack(state, attack);
    state.attack = attack;
  }

  if (attack.pattern === "frost-chain") {
    while (attack.shotCount < 3 && attack.elapsedMs >= attack.shotCount * 270) {
      const aimX = state.playerX - state.bossX;
      const aimY = state.playerY - state.bossY;
      addProjectile(
        state,
        "boss",
        state.bossX,
        state.bossY,
        aimX,
        aimY,
        BOSS_PROJECTILE_SPEED * 1.05,
        state.boss.stats.damage,
        9,
        ELEMENT_COLORS[state.boss.attributes.element],
      );
      attack.shotCount += 1;
    }
    if (attack.elapsedMs >= 920) finishAttack(state);
    return;
  }

  if (attack.pattern === "thunder-dash") {
    const dashDuration = 560;
    if (attack.elapsedMs <= dashDuration) {
      const bodySpeed = attack.pattern === "thunder-dash" ? 1 : 1;
      state.bossX = clamp(
        attack.originX + Math.cos(attack.targetAngle) * 480 * bodySpeed * (attack.elapsedMs / 1000),
        52,
        ARENA_WIDTH - 52,
      );
      state.bossY = clamp(
        attack.originY + Math.sin(attack.targetAngle) * 480 * bodySpeed * (attack.elapsedMs / 1000),
        52,
        ARENA_HEIGHT - 52,
      );
      const collisionRadius = PLAYER_RADIUS + BOSS_RADIUS[state.boss.attributes.body];
      if (
        !attack.hitPlayer &&
        distanceSquared(state.playerX, state.playerY, state.bossX, state.bossY) <=
          collisionRadius * collisionRadius
      ) {
        damagePlayer(state, state.boss.stats.damage);
        attack.hitPlayer = true;
      }
    } else {
      finishAttack(state);
    }
    return;
  }

  if (attack.pattern === "shadow-pulse") {
    const radius = (attack.elapsedMs / 940) * 245;
    const distance = length(state.playerX - state.bossX, state.playerY - state.bossY);
    if (!attack.hitPlayer && Math.abs(distance - radius) <= PLAYER_RADIUS + 10) {
      damagePlayer(state, state.boss.stats.damage);
      attack.hitPlayer = true;
    }
    if (attack.elapsedMs >= 940) finishAttack(state);
    return;
  }

  if (attack.pattern === "ember-burst" && attack.elapsedMs >= 180) finishAttack(state);
}

function finishAttack(state: CombatState): void {
  state.attack = null;
  state.attackCooldownMs = state.boss.stats.attackIntervalMs;
  // The next pattern begins from the boss's original anchor, keeping the whole arena playable.
  state.bossX = ARENA_WIDTH / 2;
  state.bossY = 172;
}

function stepProjectiles(state: CombatState, deltaMs: number): void {
  const remaining: CombatProjectile[] = [];
  const bossRadius = BOSS_RADIUS[state.boss.attributes.body];
  for (const projectile of state.projectiles) {
    projectile.x += projectile.velocityX * (deltaMs / 1000);
    projectile.y += projectile.velocityY * (deltaMs / 1000);
    if (
      projectile.x < -40 ||
      projectile.x > ARENA_WIDTH + 40 ||
      projectile.y < -40 ||
      projectile.y > ARENA_HEIGHT + 40
    )
      continue;

    if (projectile.owner === "player") {
      const collision = projectile.radius + bossRadius;
      if (
        distanceSquared(projectile.x, projectile.y, state.bossX, state.bossY) <=
        collision * collision
      ) {
        state.bossHealth = Math.max(0, state.bossHealth - projectile.damage);
        state.lastBossHitMs = state.elapsedMs;
        continue;
      }
    } else {
      const collision = projectile.radius + PLAYER_RADIUS;
      if (
        distanceSquared(projectile.x, projectile.y, state.playerX, state.playerY) <=
        collision * collision
      ) {
        damagePlayer(state, projectile.damage);
        continue;
      }
    }
    remaining.push(projectile);
  }
  state.projectiles = remaining;
}

export function stepCombat(
  previous: CombatState,
  input: CombatInput,
  elapsedMs: number,
): CombatState {
  if (previous.status !== "active") return previous;
  const deltaMs = clamp(elapsedMs, 0, 100);
  if (deltaMs === 0) return previous;
  const state: CombatState = {
    ...previous,
    elapsedMs: previous.elapsedMs + deltaMs,
    boss: previous.boss,
    projectiles: previous.projectiles.map((projectile) => ({ ...projectile })),
    attack: previous.attack ? { ...previous.attack } : null,
    selectedAmmo: input.ammo ?? previous.selectedAmmo,
    playerInvulnerabilityMs: Math.max(0, previous.playerInvulnerabilityMs - deltaMs),
    playerDodgeMs: Math.max(0, previous.playerDodgeMs - deltaMs),
    dodgeCooldownMs: Math.max(0, previous.dodgeCooldownMs - deltaMs),
    shotCooldownMs: Math.max(0, previous.shotCooldownMs - deltaMs),
  };

  let moveX = clamp(input.moveX ?? 0, -1, 1);
  let moveY = clamp(input.moveY ?? 0, -1, 1);
  if (input.dodgePressed && state.dodgeCooldownMs === 0) {
    if (moveX === 0 && moveY === 0) {
      moveX = state.playerX - state.bossX;
      moveY = state.playerY - state.bossY;
    }
    const dodgeVector = normalize(moveX, moveY);
    moveX = dodgeVector.x;
    moveY = dodgeVector.y;
    state.playerDodgeMs = DODGE_DURATION_MS;
    state.playerInvulnerabilityMs = Math.max(
      state.playerInvulnerabilityMs,
      DODGE_INVULNERABILITY_MS,
    );
    state.dodgeCooldownMs = DODGE_COOLDOWN_MS;
  }
  const movement = normalize(moveX, moveY);
  const moveSpeed = state.playerDodgeMs > 0 ? DODGE_SPEED : PLAYER_SPEED;
  state.playerX = clamp(
    state.playerX + movement.x * moveSpeed * (deltaMs / 1000),
    PLAYER_RADIUS,
    ARENA_WIDTH - PLAYER_RADIUS,
  );
  state.playerY = clamp(
    state.playerY + movement.y * moveSpeed * (deltaMs / 1000),
    PLAYER_RADIUS,
    ARENA_HEIGHT - PLAYER_RADIUS,
  );

  if (input.attackPressed && state.shotCooldownMs === 0) {
    const aimX = (input.aimX ?? state.bossX) - state.playerX;
    const aimY = (input.aimY ?? state.bossY) - state.playerY;
    const damage =
      state.selectedAmmo === state.boss.attributes.weakness
        ? Math.round(PLAYER_SHOT_DAMAGE * WEAKNESS_DAMAGE_MULTIPLIER)
        : PLAYER_SHOT_DAMAGE;
    addProjectile(
      state,
      "player",
      state.playerX,
      state.playerY,
      aimX,
      aimY,
      PLAYER_SHOT_SPEED,
      damage,
      7,
      AMMO_COLORS[state.selectedAmmo],
    );
    state.shotCooldownMs = PLAYER_SHOT_COOLDOWN_MS;
  }

  advanceBossAttack(state, deltaMs);
  stepProjectiles(state, deltaMs);

  // A same-tick final player hit resolves as a streamer victory, deterministically.
  if (state.bossHealth <= 0) state.status = "streamer-won";
  else if (state.playerHealth <= 0) state.status = "community-won";
  return state;
}
