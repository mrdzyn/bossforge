import { useEffect, useRef, useState } from "react";
import type { OverlayBattleStateV1 } from "@bossforge/shared";
import {
  battleCountdownLabel,
  shouldAnimateAcceptedHits,
  type OverlayBattleView,
} from "./overlay-battle-presentation.js";

const cancelLabels: Record<NonNullable<OverlayBattleStateV1["cancelReason"]>, string> = {
  owner_cancelled: "OWNER CANCELLED",
  forge_reset: "FORGE RESET",
  provider_changed: "PROVIDER CHANGED",
  twitch_disconnected: "TWITCH CONNECTION LOST",
  twitch_session_invalidated: "TWITCH SESSION INVALIDATED",
  server_shutdown: "SERVER SHUTDOWN",
};

export function OverlayBattleHud({
  battle,
  view,
  simulated,
}: {
  battle: OverlayBattleStateV1 | null;
  view: OverlayBattleView;
  simulated: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const [impact, setImpact] = useState(false);
  const [weaknessImpact, setWeaknessImpact] = useState(false);
  const previous = useRef<OverlayBattleStateV1 | null>(null);
  const impactTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weaknessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationIdentity = useRef<string | null>(null);
  const battleIdentity = battle
    ? `${battle.serverInstanceId}:${battle.serverStartedAt}:${battle.encounterId}`
    : null;
  useEffect(() => {
    if (view !== "active" || !battle?.deadlineAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [battle?.encounterId, battle?.deadlineAt, view]);
  useEffect(() => {
    const old = previous.current;
    previous.current = battle;
    const identity = battleIdentity;
    const active = view === "active" && battle?.status === "active";
    const identityChanged = animationIdentity.current !== identity;
    const clearTimers = () => {
      if (impactTimeout.current !== null) clearTimeout(impactTimeout.current);
      if (weaknessTimeout.current !== null) clearTimeout(weaknessTimeout.current);
      impactTimeout.current = null;
      weaknessTimeout.current = null;
    };

    if (!active || identityChanged) {
      clearTimers();
      setImpact(false);
      setWeaknessImpact(false);
      animationIdentity.current = active ? identity : null;
      return;
    }
    if (!old || !battle || !shouldAnimateAcceptedHits(old, battle, view)) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      clearTimers();
      setImpact(false);
      setWeaknessImpact(false);
      return;
    }

    clearTimers();
    const effectIdentity = identity;
    setImpact(true);
    const nextImpactTimeout = setTimeout(() => {
      if (animationIdentity.current === effectIdentity) setImpact(false);
      if (impactTimeout.current === nextImpactTimeout) impactTimeout.current = null;
    }, 420);
    impactTimeout.current = nextImpactTimeout;
    if (battle.weaknessHitCount > old.weaknessHitCount) {
      setWeaknessImpact(true);
      const nextWeaknessTimeout = setTimeout(() => {
        if (animationIdentity.current === effectIdentity) setWeaknessImpact(false);
        if (weaknessTimeout.current === nextWeaknessTimeout) weaknessTimeout.current = null;
      }, 520);
      weaknessTimeout.current = nextWeaknessTimeout;
    } else {
      // An ordinary accepted hit supersedes the weakness accent immediately.
      // clearTimers() above cancels its pending expiry so it cannot affect the next hit.
      setWeaknessImpact(false);
    }
  }, [battle, battleIdentity, view]);
  useEffect(
    () => () => {
      if (impactTimeout.current !== null) clearTimeout(impactTimeout.current);
      if (weaknessTimeout.current !== null) clearTimeout(weaknessTimeout.current);
      impactTimeout.current = null;
      weaknessTimeout.current = null;
      animationIdentity.current = null;
    },
    [],
  );

  if (view === "unavailable")
    return (
      <section className="m2c-status m2c-unavailable" role="status">
        <strong>SERVER LINK UNAVAILABLE</strong>
        <span>BATTLE STATUS UNKNOWN</span>
      </section>
    );
  if (view === "awaiting") return <section className="m2c-status">AWAITING FORGE</section>;
  if (view === "waiting-battle")
    return (
      <section className="m2c-status" role="status">
        WAITING FOR VERIFIED BATTLE STATE
      </section>
    );
  if (view === "disconnected")
    return <section className="m2c-status m2c-disconnected">TWITCH DISCONNECTED</section>;
  if (view === "voting" || view === "forge-failed") return null;
  if (!battle) return null;
  if (view === "ready")
    return (
      <section className="m2c-status m2c-ready" role="status">
        BATTLE READY
      </section>
    );
  if (view === "victory")
    return (
      <section className="m2c-terminal m2c-victory" role="status">
        COMMUNITY VICTORY! BOSS DEFEATED!
      </section>
    );
  if (view === "expired")
    return (
      <section className="m2c-terminal m2c-expired" role="status">
        BOSS SURVIVED! TRY AGAIN!
      </section>
    );
  if (view === "cancelled")
    return (
      <section className="m2c-terminal m2c-cancelled" role="status">
        <strong>BATTLE CANCELLED</strong>
        <span>
          {battle.cancelReason ? cancelLabels[battle.cancelReason] : "SESSION INVALIDATED"}
        </span>
      </section>
    );

  const hp = battle.currentHp ?? 0;
  const maxHp = battle.maxHp ?? 1;
  const percent = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const countdown = battle.deadlineAt
    ? battleCountdownLabel(battle.deadlineAt, now)
    : "RESOLVING BATTLE";
  const hasTime = countdown !== "RESOLVING BATTLE";
  return (
    <section
      className={`m2c-battle-hud ${impact && animationIdentity.current === battleIdentity ? "is-impact" : ""} ${weaknessImpact && animationIdentity.current === battleIdentity ? "is-weakness" : ""}`}
      aria-label="Community boss battle"
    >
      <div className="m2c-hud-heading">
        <div>
          <span className="eyebrow">BATTLE ACTIVE · COMMUNITY BOSS</span>
          <h2>{battle.bossSnapshot?.name ?? "COMMUNITY BOSS"}</h2>
        </div>
        <span className="m2c-source">{simulated ? "SIMULATED" : "LIVE TWITCH"}</span>
      </div>
      <div className="m2c-hud-stats">
        <span>
          WEAKNESS <b>{battle.bossSnapshot?.attributes.weakness.toUpperCase()}</b>
        </span>
        <span>
          ATTACKS <b>{battle.acceptedHitCount}</b>
        </span>
        <span className="m2c-timer">{countdown}</span>
      </div>
      <div className={`m2c-hp ${impact ? "is-impact" : ""}`}>
        <div className="m2c-hp-label">
          <strong>BOSS HP</strong>
          <span>
            {hp} / {maxHp}
          </span>
        </div>
        <div
          className="m2c-hp-track"
          role="progressbar"
          aria-label="Boss health"
          aria-valuemin={0}
          aria-valuemax={maxHp}
          aria-valuenow={hp}
          aria-valuetext={`${hp} of ${maxHp} HP`}
        >
          <div className="m2c-hp-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      {hasTime ? (
        <div className="m2c-commands">
          <strong>CHAT, FIGHT TOGETHER</strong>
          <span>
            <code>!hit</code> · 8 damage
          </span>
          <span>
            <code>!hit {battle.bossSnapshot?.attributes.weakness}</code> · 14 damage · weakness
            bonus
          </span>
        </div>
      ) : (
        <p className="m2c-resolving" role="status">
          Waiting for the server’s battle result…
        </p>
      )}
    </section>
  );
}
