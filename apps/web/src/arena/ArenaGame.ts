import Phaser from "phaser";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  createCombatState,
  getAmmoColor,
  getBossCollisionRadius,
  getBossElementColor,
  startCombat,
  stepCombat,
  type Boss,
  type CombatInput,
  type CombatState,
} from "@bossforge/shared";

class ArenaScene extends Phaser.Scene {
  private state!: CombatState;
  private graphics!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key | undefined>;
  private lastPublish = 0;
  private readonly publish: (state: CombatState) => void;

  constructor(boss: Boss, publish: (state: CombatState) => void) {
    super("arena");
    this.state = createCombatState(boss);
    this.publish = publish;
  }

  create() {
    this.graphics = this.add.graphics();
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.keys = keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,ONE,TWO,THREE,FOUR",
    ) as Record<string, Phaser.Input.Keyboard.Key | undefined>;
    this.input.on("pointerdown", () => {
      if (this.state.status === "ready") this.state = startCombat(this.state);
    });
    this.state = startCombat(this.state);
    this.publish(this.state);
  }

  update(_time: number, delta: number) {
    if (!this.keys) return;
    const pointer = this.input.activePointer;
    const worldPointer = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const justDown = Phaser.Input.Keyboard.JustDown;
    const isDown = (name: string) => this.keys[name]?.isDown ?? false;
    const justPressed = (name: string) => {
      const key = this.keys[name];
      return key ? justDown(key) : false;
    };
    const ammo = isDown("ONE")
      ? "water"
      : isDown("TWO")
        ? "light"
        : isDown("THREE")
          ? "earth"
          : isDown("FOUR")
            ? "wind"
            : undefined;
    const input: CombatInput = {
      moveX: Number(isDown("D") || isDown("RIGHT")) - Number(isDown("A") || isDown("LEFT")),
      moveY: Number(isDown("S") || isDown("DOWN")) - Number(isDown("W") || isDown("UP")),
      dodgePressed: justPressed("SHIFT"),
      attackPressed: pointer.isDown || justPressed("SPACE"),
      aimX: worldPointer.x,
      aimY: worldPointer.y,
      ...(ammo ? { ammo } : {}),
    };
    if (input.attackPressed && this.state.status === "ready") this.state = startCombat(this.state);
    this.state = stepCombat(this.state, input, delta);
    this.drawArena();
    if (this.time.now - this.lastPublish >= 66 || this.state.status !== "active") {
      this.publish(this.state);
      this.lastPublish = this.time.now;
    }
  }

  private drawArena() {
    const g = this.graphics;
    g.clear();
    g.fillStyle(0x101b26, 1);
    g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    g.lineStyle(1, 0x253644, 0.6);
    for (let x = 0; x <= ARENA_WIDTH; x += 48) g.lineBetween(x, 0, x, ARENA_HEIGHT);
    for (let y = 0; y <= ARENA_HEIGHT; y += 48) g.lineBetween(0, y, ARENA_WIDTH, y);
    const state = this.state;
    const bossColor = getBossElementColor(state.boss.attributes.element);
    const radius = getBossCollisionRadius(state.boss.attributes.body);
    const attack = state.attack;
    if (attack?.phase === "telegraph") {
      g.lineStyle(4, bossColor, 0.9);
      if (attack.pattern === "ember-burst") {
        g.strokeCircle(state.bossX, state.bossY, 245);
        g.lineStyle(14, 0x101b26, 0.95);
        g.lineBetween(
          state.bossX,
          state.bossY,
          state.bossX + Math.cos(attack.safeAngle) * 280,
          state.bossY + Math.sin(attack.safeAngle) * 280,
        );
      } else if (attack.pattern === "frost-chain") {
        g.lineBetween(state.bossX, state.bossY, state.playerX, state.playerY);
        g.lineBetween(state.bossX - 14, state.bossY, state.playerX - 14, state.playerY);
        g.lineBetween(state.bossX + 14, state.bossY, state.playerX + 14, state.playerY);
      } else if (attack.pattern === "thunder-dash") {
        g.lineStyle(16, bossColor, 0.34);
        g.lineBetween(
          attack.originX,
          attack.originY,
          attack.originX + Math.cos(attack.targetAngle) * 500,
          attack.originY + Math.sin(attack.targetAngle) * 500,
        );
      } else {
        g.strokeCircle(state.bossX, state.bossY, 245);
        g.fillStyle(bossColor, 0.28);
        g.fillCircle(state.bossX, state.bossY, 70);
      }
    }
    if (attack?.pattern === "shadow-pulse" && attack.phase === "active") {
      const pulseRadius = (attack.elapsedMs / 940) * 245;
      g.lineStyle(12, bossColor, 0.7);
      g.strokeCircle(state.bossX, state.bossY, pulseRadius);
    }
    for (const projectile of state.projectiles) {
      g.fillStyle(projectile.color, 1);
      g.fillCircle(projectile.x, projectile.y, projectile.radius);
      g.fillStyle(projectile.color, 0.22);
      g.fillCircle(projectile.x, projectile.y, projectile.radius * 2.5);
    }
    // Body silhouette encodes the winning body; color encodes its winning element.
    g.fillStyle(state.elapsedMs - state.lastBossHitMs < 150 ? 0xffffff : bossColor, 1);
    if (state.boss.attributes.body === "golem")
      g.fillRoundedRect(state.bossX - radius, state.bossY - radius, radius * 2, radius * 2, 12);
    else if (state.boss.attributes.body === "wraith")
      g.fillCircle(state.bossX, state.bossY, radius);
    else if (state.boss.attributes.body === "drake")
      g.fillTriangle(
        state.bossX,
        state.bossY - radius,
        state.bossX - radius,
        state.bossY + radius,
        state.bossX + radius,
        state.bossY + radius,
      );
    else g.fillRect(state.bossX - radius, state.bossY - radius, radius * 2, radius * 2);
    g.fillStyle(0xfff2cc, 1);
    g.fillCircle(state.bossX - 9, state.bossY - 4, 4);
    g.fillCircle(state.bossX + 9, state.bossY - 4, 4);
    g.fillStyle(state.elapsedMs - state.lastDamageMs < 150 ? 0xffffff : 0x76d5ff, 1);
    g.fillCircle(state.playerX, state.playerY, 17);
    g.lineStyle(2, 0xc4f5ff, 0.9);
    g.strokeCircle(state.playerX, state.playerY, 22);
  }
}

export function createArenaGame(
  parent: HTMLElement,
  boss: Boss,
  publish: (state: CombatState) => void,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    backgroundColor: "#101b26",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false },
    scene: [new ArenaScene(boss, publish)],
    audio: { noAudio: true },
  });
}

export { getAmmoColor };
