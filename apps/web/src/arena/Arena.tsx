import { useEffect, useMemo, useRef, useState } from "react";
import { RevealedForgeStateSchema, type CombatState, type ForgeState } from "@bossforge/shared";
import { createArenaGame, getAmmoColor } from "./ArenaGame.js";
import { useLiveEvents } from "../hooks/useLiveEvents.js";

function ArenaPage({ forge }: { forge: ForgeState | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [rematch, setRematch] = useState(0);
  const terminalRef = useRef(false);
  terminalRef.current = combat?.status === "streamer-won" || combat?.status === "community-won";
  const revealed = useMemo(() => {
    const parsed = RevealedForgeStateSchema.safeParse(forge);
    return parsed.success ? parsed.data : null;
  }, [forge]);
  const identity = revealed
    ? `${revealed.serverInstanceId}:${revealed.cycleId}:${revealed.boss.id}`
    : "";
  useEffect(() => {
    setCombat(null);
    if (!host.current || !revealed) return;
    const game = createArenaGame(host.current, revealed.boss, setCombat);
    const onVisibility = () => {
      if (document.hidden || terminalRef.current) game.pause();
      else game.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      game.destroy(true);
    };
    // State changes with the same cycle do not restart the local battle.
  }, [identity, rematch]);

  if (!revealed)
    return (
      <main className="arena-unavailable">
        <a className="brand" href="/">
          BOSSFORGE <span>LIVE</span>
        </a>
        <h1>A revealed boss is required</h1>
        <p>
          The arena only accepts a current, validated forge reveal. Return to the control room and
          complete a forge cycle.
        </p>
        <a className="primary-button" href="/">
          Return to forge
        </a>
      </main>
    );

  const terminal = combat?.status === "streamer-won" || combat?.status === "community-won";
  const hpPercent = combat
    ? Math.max(0, (combat.bossHealth / revealed.boss.stats.health) * 100)
    : 100;
  const playerPercent = combat ? Math.max(0, combat.playerHealth) : 100;
  return (
    <main className="arena-page">
      <header className="arena-header">
        <a className="brand" href="/">
          BOSSFORGE <span>LIVE</span>
        </a>
        <div>
          <small>LOCAL CLIENT-SIDE BATTLE</small>
          <h1>{revealed.boss.name}</h1>
        </div>
        <a className="secondary-button" href="/">
          Return to forge
        </a>
      </header>
      <section className="arena-stage">
        <div className="arena-health-row">
          <div>
            <span>
              {revealed.boss.name} · {revealed.boss.stats.damage} DMG /{" "}
              {revealed.boss.stats.attackIntervalMs} MS
            </span>
            <b>
              {combat?.bossHealth ?? revealed.boss.stats.health} / {revealed.boss.stats.health}
            </b>
            <i>
              <em className="boss-health" style={{ width: `${hpPercent}%` }} />
            </i>
          </div>
          <div>
            <span>STREAMER</span>
            <b>{combat?.playerHealth ?? 100} / 100</b>
            <i>
              <em className="player-health" style={{ width: `${playerPercent}%` }} />
            </i>
          </div>
        </div>
        <div className="arena-canvas-wrap">
          <div className="arena-canvas" ref={host} />
          {combat?.attack?.phase === "telegraph" && (
            <div className="arena-warning">
              {combat.attack.pattern.replaceAll("-", " ").toUpperCase()} · DODGE THE TELEGRAPH
            </div>
          )}
          {terminal && (
            <div className="arena-result">
              <strong>{combat.status === "streamer-won" ? "VICTORY" : "DEFEAT"}</strong>
              <span>
                {combat.status === "streamer-won"
                  ? "The streamer defeated the community-forged boss."
                  : "The boss defeated the streamer."}
              </span>
              <div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setCombat(null);
                    setRematch((value) => value + 1);
                  }}
                >
                  Rematch same boss
                </button>
                <a className="secondary-button" href="/">
                  Forge another boss
                </a>
              </div>
            </div>
          )}
          {!terminal && combat?.status === "ready" && (
            <div className="arena-start-hint">
              Move with WASD / arrows · click or Space to attack · Shift to dodge
            </div>
          )}
        </div>
        <footer className="arena-controls">
          <span>
            MOVE <b>W A S D / ARROWS</b>
          </span>
          <span>
            ATTACK <b>CLICK / SPACE</b>
          </span>
          <span>
            DODGE <b>SHIFT</b>
          </span>
          <span>
            AMMO <b>1 WATER · 2 LIGHT · 3 EARTH · 4 WIND</b>
          </span>
          <span className="arena-ammo" aria-live="polite">
            SELECTED AMMO <b>{combat?.selectedAmmo.toUpperCase() ?? "WATER"}</b>
          </span>
          <span
            className="arena-weakness"
            style={{
              color: `#${getAmmoColor(revealed.boss.attributes.weakness).toString(16).padStart(6, "0")}`,
            }}
          >
            WEAKNESS: {revealed.boss.attributes.weakness.toUpperCase()} · 75% BONUS DAMAGE
          </span>
        </footer>
        {combat && combat.elapsedMs - combat.lastBossHitMs < 220 && (
          <p className="arena-hit-feedback" role="status">
            {combat.lastBossHitFeedback === "weakness" ? "WEAKNESS HIT · BONUS DAMAGE" : "HIT"}
          </p>
        )}
        <p className="arena-disclaimer">
          Combat is a local browser simulation. Forge results remain server-authoritative; battle
          results are not persisted.
        </p>
      </section>
    </main>
  );
}

export default function Arena() {
  const { forge, snapshotAvailable } = useLiveEvents();
  return <ArenaPage forge={snapshotAvailable ? forge : null} />;
}
