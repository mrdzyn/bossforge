import { useEffect, useRef, useState } from "react";
import type { BossAttributes } from "@bossforge/shared";

const bodyAssets: Record<BossAttributes["body"], string> = {
  golem: "/assets/bosses/golem.svg",
  wraith: "/assets/bosses/wraith.svg",
  drake: "/assets/bosses/drake.svg",
  mimic: "/assets/bosses/mimic.svg",
};

const formatTrait = (value: string) => value.replaceAll("-", " ");
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export type BossPresentationPhase =
  "forging" | "reveal" | "ready" | "active" | "victory" | "expired" | "cancelled" | "unavailable";

interface AnimationSnapshot {
  identity: string | null;
  phase: BossPresentationPhase;
  acceptedHitCount: number;
  weaknessHitCount: number;
  hasAttributes: boolean;
}

export interface AnimatedBossProps {
  attributes: BossAttributes | null;
  phase: BossPresentationPhase;
  authorityIdentity?: string | null;
  acceptedHitCount?: number;
  weaknessHitCount?: number;
  currentHp?: number | null;
  maxHp?: number | null;
  className?: string;
  loading?: "eager" | "lazy";
}

/** Original VecSynIQ character art with authority-gated, non-destructive CSS motion. */
export function AnimatedBoss({
  attributes,
  phase,
  authorityIdentity = null,
  acceptedHitCount = 0,
  weaknessHitCount = 0,
  currentHp = null,
  maxHp = null,
  className = "",
  loading = "eager",
}: AnimatedBossProps) {
  const [impact, setImpact] = useState(false);
  const [weaknessImpact, setWeaknessImpact] = useState(false);
  const [revealEffect, setRevealEffect] = useState(false);
  const [defeatEffect, setDefeatEffect] = useState(false);
  const previous = useRef<AnimationSnapshot | null>(null);
  const identityRef = useRef<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const identity = attributes && authorityIdentity ? authorityIdentity : null;

  useEffect(() => {
    const old = previous.current;
    const current: AnimationSnapshot = {
      identity,
      phase,
      acceptedHitCount,
      weaknessHitCount,
      hasAttributes: attributes !== null,
    };
    previous.current = current;
    const clearTimers = () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    };
    const schedule = (callback: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        callback();
      }, ms);
      timers.current.add(timer);
    };
    const motionUnavailable =
      !attributes ||
      !identity ||
      phase === "unavailable" ||
      phase === "cancelled" ||
      phase === "expired";
    const identityChanged = identityRef.current !== identity;

    const enteringTerminal =
      (phase === "victory" || phase === "expired" || phase === "cancelled") && old?.phase !== phase;
    if (motionUnavailable || identityChanged || enteringTerminal) {
      clearTimers();
      setImpact(false);
      setWeaknessImpact(false);
      setRevealEffect(false);
      if (phase !== "victory") setDefeatEffect(false);
      identityRef.current = identity;
    }

    if (motionUnavailable || !old) return;

    if (!old.hasAttributes && attributes && (old.phase === "forging" || old.phase === "reveal")) {
      setRevealEffect(true);
      schedule(() => setRevealEffect(false), 900);
    }

    if (
      phase === "victory" &&
      old.phase === "active" &&
      old.identity === identity &&
      !identityChanged &&
      !prefersReducedMotion()
    ) {
      setDefeatEffect(true);
      schedule(() => setDefeatEffect(false), 1100);
    }

    if (
      phase !== "active" ||
      old.phase !== "active" ||
      old.identity !== identity ||
      identityChanged ||
      acceptedHitCount <= old.acceptedHitCount ||
      prefersReducedMotion()
    )
      return;

    clearTimers();
    setImpact(true);
    schedule(() => setImpact(false), 420);
    if (weaknessHitCount > old.weaknessHitCount) {
      setWeaknessImpact(true);
      schedule(() => setWeaknessImpact(false), 520);
    } else {
      setWeaknessImpact(false);
    }
  }, [acceptedHitCount, attributes, authorityIdentity, identity, phase, weaknessHitCount]);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
      identityRef.current = null;
    },
    [],
  );

  const healthRatio =
    phase === "active" && currentHp !== null && maxHp !== null && maxHp > 0
      ? Math.max(0, Math.min(1, currentHp / maxHp))
      : null;
  const lowHealth = healthRatio !== null && healthRatio <= 0.25;
  const classes = [
    "animated-boss",
    `phase-${phase}`,
    attributes ? `body-${attributes.body}` : "body-unrevealed",
    attributes ? `element-${attributes.element}` : "element-neutral",
    impact ? "is-hit" : "",
    weaknessImpact ? "is-weakness-impact" : "",
    revealEffect ? "is-revealing" : "",
    defeatEffect ? "is-defeating" : "",
    lowHealth ? "is-low-health" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={classes} data-phase={phase} data-identity={identity ?? undefined}>
      <div className="animated-boss-stage" aria-hidden="true">
        <span className="animated-boss-aura" />
        <span className="animated-boss-elemental-effect" />
        {attributes ? (
          <img
            className="animated-boss-image"
            src={bodyAssets[attributes.body]}
            alt=""
            loading={loading}
            decoding="async"
            draggable={false}
          />
        ) : (
          <span className="animated-boss-forging-mark">✧</span>
        )}
        {impact && <span className="animated-boss-hit-flash" />}
        {weaknessImpact && <span className="animated-boss-weakness-flash" />}
      </div>
      <figcaption className="sr-only">
        {attributes
          ? `${formatTrait(attributes.body)} boss, ${formatTrait(attributes.element)}, ${formatTrait(attributes.special)}, weak to ${attributes.weakness}`
          : "Boss identity will be shown after all four forge votes are authoritative."}
      </figcaption>
    </figure>
  );
}
