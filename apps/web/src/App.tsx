import { lazy, Suspense, useEffect, useState } from "react";
import {
  currentVoteLeader,
  humanizeVoteChoice,
  remainingVoteSeconds,
  type ForgeState,
  type BossAttributes,
  type CommunityBattleStateV1,
  winnerAttribution,
} from "@bossforge/shared";
import { useLiveEvents } from "./hooks/useLiveEvents.js";
import { useBattleState } from "./hooks/useBattleState.js";
import { FORGE_DURATIONS, forgeCountdownLabel, type ForgeDuration } from "./live-forge-ui.js";
import { VoteInstructions } from "./VoteInstructions.js";
import { LiveVoteSurface } from "./LiveVoteSurface.js";
import { authoritativeReveal, currentForgePresentation } from "./forge-presentation.js";
import { OverlayBattleHud } from "./OverlayBattleHud.js";
import { overlayBattleView } from "./overlay-battle-presentation.js";
import { AnimatedBoss, type BossPresentationPhase } from "./components/AnimatedBoss.js";

const Arena = lazy(() => import("./arena/Arena.js"));

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-logo-mark ${className}`.trim()}
      src="/assets/branding/bossforge-mark.svg"
      alt=""
      aria-hidden="true"
      width="36"
      height="36"
      decoding="async"
    />
  );
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="BossForge dashboard">
      <BrandMark />
      <span className="brand-name">
        BOSSFORGE<span>LIVE</span>
      </span>
    </a>
  );
}
function Sidebar({
  overlay = false,
  mode = null,
}: {
  overlay?: boolean;
  mode?: "mock" | "twitch" | null;
}) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="nav-label">WORKSPACE</div>
      <a className={`nav-item ${overlay ? "" : "active"}`} href="/">
        ◈ &nbsp; Control room
      </a>
      <a className={`nav-item ${overlay ? "active" : ""}`} href="/overlay">
        ▧ &nbsp; OBS overlay
      </a>
      <div className="sidebar-bottom">
        <div className="avatar">M</div>
        <div>
          <strong>Local session</strong>
          <span>
            {mode === null
              ? "SERVER STATE UNKNOWN"
              : mode === "mock"
                ? "SIMULATION MODE"
                : "TWITCH MODE"}
          </span>
        </div>
      </div>
    </aside>
  );
}
function Connection({ status }: { status: string }) {
  return (
    <span className={`connection-pill ${status}`}>
      <i />
      {status === "connected" ? "SERVER LINK" : status.toUpperCase()}
    </span>
  );
}
const title = (value: string) => value.replaceAll("-", " ").toUpperCase();

function battlePresentationPhase(
  battle: Pick<CommunityBattleStateV1, "status"> | null,
): BossPresentationPhase {
  switch (battle?.status) {
    case "active":
    case "victory":
    case "expired":
    case "cancelled":
    case "ready":
      return battle.status;
    default:
      return "reveal";
  }
}

function BossArt({
  state,
  battle = null,
}: {
  state: ForgeState | null;
  battle?: Pick<
    CommunityBattleStateV1,
    "status" | "encounterId" | "acceptedHitCount" | "weaknessHitCount" | "currentHp" | "maxHp"
  > | null;
}) {
  const reveal = authoritativeReveal(state);
  const attributes: BossAttributes | null = reveal?.boss.attributes ?? null;
  const phase: BossPresentationPhase = attributes ? battlePresentationPhase(battle) : "forging";
  const authorityIdentity =
    state && reveal
      ? `${state.serverInstanceId}:${state.serverStartedAt}:${state.mode}:${state.cycleId}:${battle?.encounterId ?? "revealed"}`
      : null;
  const traits = attributes
    ? `${title(attributes.body)} · ${title(attributes.element)}`
    : "COMMUNITY VOTES IN PROGRESS";
  return (
    <div className={`boss-art ${attributes ? `element-${attributes.element}` : "element-neutral"}`}>
      <AnimatedBoss
        attributes={attributes}
        phase={phase}
        authorityIdentity={authorityIdentity}
        acceptedHitCount={battle?.status === "active" ? battle.acceptedHitCount : 0}
        weaknessHitCount={battle?.status === "active" ? battle.weaknessHitCount : 0}
        currentHp={battle?.status === "active" ? battle.currentHp : null}
        maxHp={battle?.status === "active" ? battle.maxHp : null}
        loading="eager"
      />
      <span className="art-tag tag-top">FORGE ENTITY / {state?.cycleId ?? "AWAITING VOTES"}</span>
      <span className="art-tag tag-bottom">{traits}</span>
    </div>
  );
}

function CategoryResults({ state }: { state: ForgeState }) {
  return (
    <div className="category-list">
      {state.categories.map((category, index) => (
        <section className={`category-result ${category.status}`} key={category.category}>
          <div className="category-heading">
            <div>
              <span className="category-index">0{index + 1}</span>
              <strong>{title(category.category)}</strong>
            </div>
            <span className="category-state">
              {category.status === "open" ? "VOTING NOW" : category.status.toUpperCase()}
            </span>
          </div>
          {category.status === "open" || category.status === "closed" ? (
            <div className="result-options">
              {category.options.map((option) => (
                <div
                  className={`result-option ${category.winner === option.choice ? "winner" : ""}`}
                  key={option.choice}
                >
                  <span>{title(option.choice)}</span>
                  <div className="result-track">
                    <i style={{ width: `${option.percentage}%` }} />
                  </div>
                  <b>{option.percentage}%</b>
                  <b>{option.count}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Waiting for this vote category.</p>
          )}
          {category.status === "open" && state.activeCategory === category.category && (
            <>
              <VoteInstructions
                category={category}
                mode={state.mode}
                connectedToTwitch={state.connectedToTwitch}
                surface="dashboard"
              />
              {(() => {
                const leader = currentVoteLeader(category.options);
                if (!leader) return null;
                return leader.status === "leader" ? (
                  <p className="current-leader" aria-live="polite">
                    Leading right now: <strong>{humanizeVoteChoice(leader.choice)}</strong> ·{" "}
                    {leader.count} vote{leader.count === 1 ? "" : "s"}
                  </p>
                ) : (
                  <p className="current-leader" aria-live="polite">
                    Tied for the lead · {leader.count} vote{leader.count === 1 ? "" : "s"} each
                  </p>
                );
              })()}
            </>
          )}
          {category.status === "closed" && category.winner && (
            <small className={`winner-source ${category.noVoteFallback ? "default" : "community"}`}>
              {winnerAttribution(category.winner, category.noVoteFallback)}
            </small>
          )}
        </section>
      ))}
    </div>
  );
}

export function Dashboard() {
  const battleLive = useBattleState();
  const {
    forge: cachedForge,
    connection,
    error,
    notice,
    post,
    snapshotAvailable,
    activity,
  } = useLiveEvents();
  const forge =
    connection === "connected" && snapshotAvailable ? currentForgePresentation(cachedForge) : null;
  const currentActivity =
    activity &&
    forge &&
    activity.serverInstanceId === forge.serverInstanceId &&
    activity.cycleId === forge.cycleId
      ? activity
      : null;
  const [seconds, setSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState<ForgeDuration>(15);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [twitch, setTwitch] = useState<{
    configured: boolean;
    mode: "mock" | "twitch";
    identity: { login: string; displayName: string } | null;
    connected: boolean;
    status: string;
  } | null>(null);
  const refreshTwitch = async () => {
    try {
      const response = await fetch("/api/twitch/status");
      if (response.ok) setTwitch(await response.json());
    } catch {
      // The regular connection state already reports local server availability.
    }
  };
  const twitchAction = async (path: string) => {
    try {
      const response = await fetch(path, { method: "POST" });
      if (!response.ok) throw new Error("Twitch control request was rejected");
      await refreshTwitch();
      return true;
    } catch {
      await refreshTwitch();
      return false;
    }
  };
  const readEventSubDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const response = await fetch("/api/dev/twitch/diagnostics", { method: "POST" });
      if (!response.ok) {
        setDiagnostics(null);
        setDiagnosticsError(
          response.status === 404
            ? "Diagnostics are disabled or unavailable."
            : response.status === 401
              ? "Twitch owner authorization is required."
              : "The local diagnostics request was rejected.",
        );
        return;
      }
      setDiagnostics(JSON.stringify(await response.json(), null, 2));
    } catch {
      setDiagnostics(null);
      setDiagnosticsError("Unable to read local diagnostics.");
    } finally {
      setDiagnosticsLoading(false);
    }
  };
  useEffect(() => {
    void refreshTwitch();
    const timer = setInterval(() => void refreshTwitch(), 2000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSeconds(
          remainingVoteSeconds(
            forge?.categories.find((item) => item.category === forge.activeCategory)?.closesAt ??
              null,
            Date.now(),
          ),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [forge]);
  const activeCategory = forge?.categories.find((item) => item.category === forge.activeCategory);
  const isRevealed = forge?.status === "revealed";
  const battle = battleLive.state;
  const battleMatchesForge = Boolean(
    battle &&
    forge?.status === "revealed" &&
    battle.forgeCycleId === forge.cycleId &&
    battle.forgeIdentity?.serverInstanceId === forge.serverInstanceId &&
    battle.forgeIdentity.serverStartedAt === forge.serverStartedAt &&
    battle.forgeIdentity.mode === forge.mode &&
    battle.bossSnapshot?.id === forge.boss?.id &&
    battle.bossSnapshot?.attributes.weakness === forge.boss?.attributes.weakness,
  );
  const battleProviderReady =
    forge?.mode === "mock"
      ? Boolean(forge && forge.simulated)
      : Boolean(forge?.connectedToTwitch && twitch?.identity && twitch.connected);
  const dashboardBattleLabel =
    !battleLive.fresh || !battleMatchesForge
      ? "WAITING FOR VERIFIED BATTLE STATE"
      : battle?.status === "ready"
        ? "BATTLE READY"
        : battle?.status === "active"
          ? "BATTLE ACTIVE"
          : battle?.status === "victory"
            ? "COMMUNITY VICTORY! BOSS DEFEATED!"
            : battle?.status === "expired"
              ? "BOSS SURVIVED! TRY AGAIN!"
              : battle?.status === "cancelled"
                ? "BATTLE CANCELLED"
                : "WAITING FOR VERIFIED BATTLE STATE";
  const [battleDuration, setBattleDuration] = useState<60 | 90 | 120>(90);
  const [audienceBand, setAudienceBand] = useState<"low" | "medium" | "high">("medium");
  const battleCountdown = battle?.deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(battle.deadlineAt) - Date.now()) / 1000))
    : null;
  const startBattle = () => {
    if (!battle?.forgeIdentity) return;
    void battleLive.mutate("start", {
      requestId: crypto.randomUUID(),
      expectedRevision: battle.revision,
      forgeIdentity: battle.forgeIdentity,
      forgeCycleId: battle.forgeCycleId,
      durationSeconds: battleDuration,
      audienceBand,
    });
  };
  const cancelBattle = () => {
    if (!battle?.encounterId) return;
    void battleLive.mutate("cancel", {
      requestId: crypto.randomUUID(),
      expectedRevision: battle.revision,
      encounterId: battle.encounterId,
    });
  };
  return (
    <div className="app-shell">
      <Sidebar mode={forge?.mode ?? null} />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            WORKSPACE <span>/</span> CONTROL ROOM
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <i />{" "}
              {connection !== "connected"
                ? "SERVER LINK UNAVAILABLE"
                : !forge
                  ? "WAITING FOR FRESH SERVER STATE"
                  : forge.connectedToTwitch
                    ? "LIVE TWITCH"
                    : forge.mode === "mock"
                      ? "SIMULATED"
                      : "TWITCH DISCONNECTED"}
            </span>
            <Connection status={connection} />
          </div>
        </header>
        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <span className="generic-label">GENERIC / OBS</span>
              <p className="eyebrow">
                STREAMER DASHBOARD <span>•</span>{" "}
                {connection !== "connected"
                  ? "SERVER LINK UNAVAILABLE"
                  : !forge
                    ? "WAITING FOR FRESH SERVER STATE"
                    : forge.connectedToTwitch
                      ? "LIVE TWITCH"
                      : forge.mode === "mock"
                        ? "SIMULATED"
                        : "TWITCH DISCONNECTED"}
              </p>
              <h1>
                Make something <em>monstrous.</em>
              </h1>
              <p className="subheading">Four timed votes. One boss forged by chat.</p>
              <p className="game-agnostic-copy">
                Chat creates the boss. Chat fights the boss. You keep playing.
              </p>
              <p className="obs-explainer">
                Add the read-only OBS Browser Source beside your game. It does not read, control, or
                integrate with the game.
              </p>
            </div>
            <div className="dashboard-actions">
              <label className="duration-control">
                <span>SECONDS / CATEGORY</span>
                <select
                  aria-label="Seconds per voting category"
                  value={durationSeconds}
                  disabled={forge?.status === "voting"}
                  onChange={(event) =>
                    setDurationSeconds(Number(event.target.value) as ForgeDuration)
                  }
                >
                  {FORGE_DURATIONS.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} seconds
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary-button"
                disabled={
                  !forge ||
                  forge?.status === "voting" ||
                  (forge?.mode === "twitch" && !forge.connectedToTwitch)
                }
                onClick={async () => {
                  if (
                    (isRevealed || forge?.status === "failed") &&
                    !(await post("/api/dev/forge/reset"))
                  )
                    return;
                  await post("/api/dev/forge/start", { durationSeconds });
                }}
              >
                {isRevealed ? "✦ Forge again" : "✦ Start the forge"}
              </button>
              {forge && forge.status !== "idle" && (
                <button
                  className="secondary-button"
                  onClick={() => void post("/api/dev/forge/reset")}
                >
                  Reset cycle
                </button>
              )}
              {isRevealed && (
                <div className="arena-demo-link">
                  <a className="secondary-button arena-entry" href="/arena">
                    ⚔ Optional Arena demo
                  </a>
                  <small>Separate local Phaser demo; not the future Twitch encounter.</small>
                </div>
              )}
            </div>
          </section>
          <section className="panel battle-owner-panel" aria-label="Streamer battle controls">
            <div className="panel-heading">
              <h2>Community encounter</h2>
              <span className="eyebrow">SERVER-AUTHORITATIVE ENCOUNTER</span>
            </div>
            {!battleLive.fresh || !battle ? (
              <p className="muted">
                Battle state unavailable until a fresh server snapshot is received.
              </p>
            ) : (!battleMatchesForge &&
                (battle.status === "active" ||
                  forge?.status === "failed" ||
                  !["victory", "expired", "cancelled"].includes(battle.status))) ||
              (battle.status === "active" && !battleProviderReady) ? (
              <p className="muted">Complete all four forge stages to prepare a battle.</p>
            ) : (
              <>
                <p className="eyebrow">
                  {forge?.mode === "mock"
                    ? "SIMULATED · LOCAL DEVELOPMENT"
                    : forge?.connectedToTwitch
                      ? "LIVE TWITCH · VERIFIED CONNECTION"
                      : "TWITCH DISCONNECTED"}
                </p>
                <strong>
                  {battle.status === "ready"
                    ? "BATTLE READY"
                    : battle.status === "active"
                      ? "BATTLE ACTIVE"
                      : battle.status.toUpperCase()}
                </strong>
                {battle.bossSnapshot && (
                  <p>
                    {battle.bossSnapshot.name} · Weakness: {battle.bossSnapshot.attributes.weakness}
                  </p>
                )}
                {battle.status === "ready" && (
                  <div className="dashboard-actions">
                    <label>
                      <span>Duration</span>
                      <select
                        aria-label="Battle duration"
                        value={battleDuration}
                        onChange={(event) =>
                          setBattleDuration(Number(event.target.value) as 60 | 90 | 120)
                        }
                      >
                        <option value={60}>60 seconds</option>
                        <option value={90}>90 seconds</option>
                        <option value={120}>120 seconds</option>
                      </select>
                    </label>
                    <label>
                      <span>Expected audience</span>
                      <select
                        aria-label="Expected audience band"
                        value={audienceBand}
                        onChange={(event) =>
                          setAudienceBand(event.target.value as "low" | "medium" | "high")
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <button
                      className="primary-button"
                      disabled={!battleProviderReady || !battleMatchesForge}
                      onClick={startBattle}
                    >
                      Start Battle
                    </button>
                  </div>
                )}
                {battle.status === "active" && (
                  <div aria-live="polite">
                    <p>
                      Boss HP {battle.currentHp}/{battle.maxHp} · {battleCountdown}s remaining ·{" "}
                      {battle.acceptedHitCount} accepted attacks
                    </p>
                    <p>
                      Attack in chat: <code>!hit</code> · Weakness:{" "}
                      <code>!hit {battle.bossSnapshot?.attributes.weakness}</code>
                    </p>
                    <p>
                      {forge?.mode === "mock"
                        ? "SIMULATED"
                        : forge?.connectedToTwitch
                          ? "LIVE TWITCH"
                          : "TWITCH DISCONNECTED"}
                      {battleLive.activity &&
                        battleLive.activity.encounterId === battle.encounterId &&
                        ` · ${battleLive.activity.rejected} rejected commands · ${battleLive.activity.weaknessMismatch} nonmatching weakness attacks`}
                    </p>
                  </div>
                )}
                {battle.status === "active" || battle.status === "ready" ? (
                  <button
                    className="secondary-button"
                    disabled={!battleProviderReady}
                    onClick={cancelBattle}
                  >
                    Cancel encounter
                  </button>
                ) : null}
                {battle.status === "cancelled" && (
                  <p>
                    Encounter cancelled ({battle.cancelReason}). Start a new forge cycle to try
                    again.
                  </p>
                )}
                {battle.status === "expired" && <p>Boss survived this encounter.</p>}
                {battle.status === "victory" && <p>Community victory.</p>}
              </>
            )}
            {battleLive.error && <p role="alert">Battle request: {battleLive.error}</p>}
          </section>
          <section className="panel twitch-controls" aria-label="Twitch connection controls">
            <div>
              <p className="eyebrow">LOCAL TWITCH INTEGRATION</p>
              <strong>
                {!forge
                  ? "LOCAL SERVER UNAVAILABLE · TWITCH STATUS UNKNOWN"
                  : twitch?.identity
                    ? `${twitch.identity.displayName} (@${twitch.identity.login}) · ${twitch.connected ? "TWITCH CONNECTED" : twitch.status.toUpperCase()}`
                    : twitch?.configured
                      ? "Not authenticated"
                      : "Not configured · SIMULATED mode remains available"}
              </strong>
            </div>
            {!forge ? (
              <span className="secondary-button" aria-disabled="true">
                Twitch controls unavailable
              </span>
            ) : !twitch?.identity ? (
              <a className="secondary-button" href="http://localhost:3001/auth/twitch">
                Authorize Twitch
              </a>
            ) : (
              <div className="dashboard-actions">
                {twitch.mode === "mock" ? (
                  <button
                    className="secondary-button"
                    onClick={() => void twitchAction("/api/twitch/connect")}
                  >
                    Connect Twitch
                  </button>
                ) : (
                  <>
                    {!twitch.connected && (
                      <button
                        className="secondary-button"
                        onClick={() => void twitchAction("/api/twitch/connect")}
                      >
                        Retry Twitch connection
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      onClick={() => void twitchAction("/api/twitch/mock")}
                    >
                      Switch to simulation
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  onClick={() => void twitchAction("/api/twitch/disconnect")}
                >
                  Disconnect / log out
                </button>
              </div>
            )}
            {twitch?.identity && twitch.mode === "twitch" && (
              <div className="eventsub-diagnostics">
                <button
                  className="text-button"
                  disabled={!forge || diagnosticsLoading}
                  onClick={() => void readEventSubDiagnostics()}
                >
                  {diagnosticsLoading ? "Reading diagnostics…" : "Read local EventSub diagnostics"}
                </button>
                {diagnosticsError && <p role="status">{diagnosticsError}</p>}
                {diagnostics && <pre aria-live="polite">{diagnostics}</pre>}
              </div>
            )}
          </section>
          {error && (
            <div className="inline-error" role="status">
              {error}
            </div>
          )}
          {notice && (
            <div className="forge-notice" role="status">
              {notice}
            </div>
          )}
          {forge?.status === "failed" && (
            <div className="forge-notice" role="status">
              No valid weakness votes arrived after two voting windows. The forge ended without a
              boss. Start a new forge to try again.
            </div>
          )}
          {forge?.status === "voting" && forge.weaknessRetry && (
            <div className="forge-notice" role="status">
              No weakness votes arrived. One final voting window is open.
            </div>
          )}
          <section className="stat-strip">
            <div className="stat-card">
              <span className="stat-icon cyan">◎</span>
              <div>
                <span className="stat-label">CHAT CONNECTION</span>
                <strong>
                  {!forge
                    ? connection === "connected"
                      ? "Waiting for fresh server state"
                      : "Local server link unavailable"
                    : forge.connectedToTwitch
                      ? "Twitch chat connected"
                      : forge.mode === "twitch"
                        ? "Twitch chat disconnected"
                        : "Local simulated chat"}
                </strong>
              </div>
              <Connection status={connection} />
            </div>
            <div className="stat-card">
              <span className="stat-icon lime">⌁</span>
              <div>
                <span className="stat-label">FORGE STATUS</span>
                <strong>
                  {!forge
                    ? "Server state unavailable"
                    : forge.status === "voting"
                      ? `Voting · ${title(forge.activeCategory ?? "")}`
                      : isRevealed
                        ? "Boss revealed"
                        : forge.status === "failed"
                          ? "Forge ended: no weakness votes"
                          : "Ready to forge"}
                </strong>
              </div>
              <span className="stat-value">{forge ? `${forge.progress} / 4` : "— / 4"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon violet">◷</span>
              <div>
                <span className="stat-label">FORGE VOTES</span>
                <strong>
                  {forge
                    ? `${activeCategory?.totalVotes ?? forge.categories.reduce((total, item) => total + item.totalVotes, 0)} votes cast`
                    : "Vote total unknown"}
                </strong>
              </div>
              <span className="stat-value">
                {activeCategory && forge?.status === "voting"
                  ? forgeCountdownLabel(activeCategory.category, seconds)
                  : "—"}
              </span>
            </div>
          </section>
          <section className="workspace-grid">
            <article className={`panel boss-panel ${isRevealed ? "revealed" : ""}`}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    {isRevealed
                      ? "THE COMMUNITY HAS FORGED"
                      : !forge
                        ? "SERVER STATE UNAVAILABLE"
                        : forge.status === "idle"
                          ? "GENERIC FORGE"
                          : "THE CHAT IS FORGING"}
                  </p>
                  <h2>
                    {isRevealed
                      ? forge?.boss?.name
                      : !forge
                        ? "Waiting for fresh state"
                        : forge.status === "idle"
                          ? "Ready to forge"
                          : "Boss in progress"}
                  </h2>
                  {isRevealed && (
                    <span className="reveal-inline-status" role="status">
                      {battleLive.fresh && battleMatchesForge
                        ? dashboardBattleLabel
                        : "WAITING FOR VERIFIED BATTLE STATE"}
                    </span>
                  )}
                </div>
                <span className={`draft-badge ${isRevealed ? "revealed" : ""}`}>
                  {isRevealed
                    ? "REVEALED"
                    : !forge
                      ? "WAITING"
                      : forge.status === "voting"
                        ? "IN PROGRESS"
                        : "READY"}{" "}
                  <i />
                </span>
              </div>
              {forge && forge.status !== "idle" ? (
                <BossArt
                  state={forge}
                  battle={battleLive.fresh && battleMatchesForge ? battle : null}
                />
              ) : (
                <div className="forge-placeholder">
                  {forge && (
                    <img
                      className="forge-placeholder-logo"
                      src="/assets/branding/bossforge-logo.svg"
                      alt="BossForge Live"
                      width="132"
                      height="132"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span>{forge ? "AWAITING FORGE" : "AUTHORITATIVE STATE UNAVAILABLE"}</span>
                  <strong>
                    {forge
                      ? "Your next boss starts with four votes."
                      : "Current boss details are hidden."}
                  </strong>
                </div>
              )}
              {isRevealed && forge?.boss && (
                <div className="boss-details">
                  <div>
                    <span className="detail-label">FORGED NAME</span>
                    <h3>{forge.boss.name}</h3>
                  </div>
                </div>
              )}
              <div className="attribute-row">
                {forge?.categories.map((category) => (
                  <span key={category.category}>
                    {title(category.category)} <b>{title(category.winner ?? "TBD")}</b>
                  </span>
                ))}
              </div>
              <div className="progress-label">
                <span>FORGE PROGRESS</span>
                <span>{forge?.progress ?? 0} / 4</span>
              </div>
              <div className="progress-track">
                <i style={{ width: `${((forge?.progress ?? 0) / 4) * 100}%` }} />
              </div>
              {isRevealed && (
                <div className="reveal-message">
                  <strong>{dashboardBattleLabel}</strong>
                  <span>Battle state and outcomes are controlled by the local server.</span>
                </div>
              )}
            </article>
            <div className="right-stack">
              <article className="panel vote-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">COMMUNITY FORGE</p>
                    <h2>Audience votes</h2>
                  </div>
                  <span className="live-indicator">
                    <i />
                    {!forge
                      ? "STATUS UNKNOWN"
                      : forge.status === "voting" && forge.activeCategory
                        ? forgeCountdownLabel(forge.activeCategory, seconds)
                        : isRevealed
                          ? "COMPLETE"
                          : "READY"}
                  </span>
                </div>
                <LiveVoteSurface
                  connection={connection}
                  snapshotAvailable={snapshotAvailable}
                  surface="dashboard"
                >
                  {forge ? (
                    <CategoryResults state={forge} />
                  ) : (
                    <p className="muted">Connecting to local forge state…</p>
                  )}
                </LiveVoteSurface>
              </article>
              <article className="panel controls-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">
                      {forge?.mode === "twitch" ? "LIVE TWITCH ACTIVITY" : "SIMULATION ACTIVITY"}
                    </p>
                    <h2>Vote activity</h2>
                  </div>
                  {forge?.mode !== "twitch" && (
                    <button
                      className="text-button"
                      disabled={!forge}
                      onClick={() => void post("/api/dev/simulation/next")}
                    >
                      Generate event
                    </button>
                  )}
                </div>
                <div className="event-feed" aria-live="polite">
                  {currentActivity ? (
                    <>
                      <div className="event-row">
                        <div className="event-copy">
                          <strong>{currentActivity.accepted}</strong>
                          <span>accepted votes</span>
                        </div>
                      </div>
                      <div className="event-row">
                        <div className="event-copy">
                          <strong>{currentActivity.rejected}</strong>
                          <span>rejected events</span>
                        </div>
                      </div>
                      <div className="event-row">
                        <div className="event-copy">
                          <strong>{currentActivity.reasons.invalid}</strong>
                          <span>invalid input</span>
                        </div>
                      </div>
                      <div className="event-row">
                        <div className="event-copy">
                          <strong>{currentActivity.reasons.duplicate}</strong>
                          <span>duplicate or unchanged</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="muted">
                      Vote activity unknown until a fresh feed and server state are available.
                    </p>
                  )}
                </div>
              </article>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              BOSSFORGE LIVE <b>•</b> CHAT CREATES THE BOSS.
            </span>
            <span>
              {connection !== "connected"
                ? "SERVER LINK UNAVAILABLE · LIVE VOTE STATUS UNKNOWN"
                : !forge
                  ? "WAITING FOR FRESH SERVER STATE · LIVE VOTE STATUS UNKNOWN"
                  : forge?.connectedToTwitch
                    ? "TWITCH CONNECTED"
                    : forge?.mode === "mock"
                      ? "SIMULATED • NOT CONNECTED TO TWITCH"
                      : "TWITCH DISCONNECTED · LIVE VOTING PAUSED"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export function OverlayPreview() {
  const {
    forge: cachedForge,
    connection,
    snapshotAvailable,
    overlayBattle,
    overlayBattleFresh,
  } = useLiveEvents("overlay");
  const forge =
    connection === "connected" && snapshotAvailable ? currentForgePresentation(cachedForge) : null;
  const category =
    forge?.status === "voting"
      ? (forge.categories.find((item) => item.category === forge.activeCategory) ?? null)
      : null;
  const reveal = authoritativeReveal(forge);
  const overlayBattleMatchesForge = Boolean(
    overlayBattleFresh &&
    overlayBattle &&
    reveal &&
    overlayBattle.forgeCycleId === forge?.cycleId &&
    overlayBattle.forgeIdentity?.serverInstanceId === forge?.serverInstanceId &&
    overlayBattle.forgeIdentity.serverStartedAt === forge?.serverStartedAt &&
    overlayBattle.forgeIdentity.mode === forge?.mode &&
    overlayBattle.bossSnapshot?.id === reveal.boss.id &&
    overlayBattle.bossSnapshot.attributes.weakness === reveal.boss.attributes.weakness,
  );
  const battleView = overlayBattleView({
    connection,
    forgeFresh: snapshotAvailable,
    battleFresh: overlayBattleFresh,
    forge,
    battle: overlayBattle,
  });
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(remainingVoteSeconds(category?.closesAt ?? null, Date.now()));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [category?.closesAt]);
  return (
    <main className="overlay-page">
      <header className="overlay-topline">
        <div className="overlay-brand">
          <BrandMark />
          <span>
            BOSSFORGE <b>LIVE</b>
          </span>
        </div>
        <div className="overlay-round">
          <span className="generic-label">GENERIC / OBS</span>
          <span className="round-live">
            <i />
            {connection !== "connected"
              ? "SERVER LINK UNAVAILABLE / LIVE VOTE STATUS UNKNOWN"
              : !forge
                ? "WAITING FOR FRESH SERVER STATE / LIVE VOTE STATUS UNKNOWN"
                : forge?.connectedToTwitch
                  ? "LIVE TWITCH"
                  : forge?.mode === "mock"
                    ? "SIMULATED / NOT CONNECTED TO TWITCH"
                    : "TWITCH DISCONNECTED / VOTING PAUSED"}
          </span>
          <span>{forge?.cycleId?.toUpperCase() ?? "AWAITING FORGE"}</span>
        </div>
      </header>
      {forge?.status === "voting" || reveal ? (
        <section className={`overlay-boss-card ${reveal ? "is-revealed" : ""}`}>
          <div className="overlay-boss-art">
            <BossArt state={forge} battle={overlayBattleMatchesForge ? overlayBattle : null} />
          </div>
          <div className="overlay-boss-info">
            <span className="eyebrow">
              {reveal ? "THE COMMUNITY HAS FORGED" : "THE CHAT IS FORGING"}
            </span>
            <h1>{reveal ? reveal.boss.name : "A BOSS IN THE MAKING"}</h1>
            {reveal ? (
              <div className="boss-tags reveal-tags">
                <span>BODY · {title(reveal.boss.attributes.body)}</span>
                <span>ELEMENT · {title(reveal.boss.attributes.element)}</span>
                <span>SPECIAL · {title(reveal.boss.attributes.special)}</span>
                <span>WEAKNESS · {title(reveal.boss.attributes.weakness)}</span>
              </div>
            ) : (
              <div className="boss-tags">
                <span>{title(forge?.categories[0]?.winner ?? "BODY TBD")}</span>
                <span>{title(forge?.categories[1]?.winner ?? "ELEMENT TBD")}</span>
              </div>
            )}
          </div>
        </section>
      ) : null}
      {forge?.status === "failed" && (
        <section className="m2c-status" role="status">
          FORGE ENDED · NO WEAKNESS VOTES AFTER TWO WINDOWS
        </section>
      )}
      {forge?.status === "voting" && forge.weaknessRetry && (
        <section className="m2c-status" role="status">
          NO WEAKNESS VOTES · FINAL VOTING WINDOW
        </section>
      )}
      <OverlayBattleHud
        battle={overlayBattle}
        view={battleView}
        simulated={forge?.mode === "mock"}
      />
      <LiveVoteSurface
        connection={connection}
        snapshotAvailable={snapshotAvailable}
        surface="overlay"
      >
        <section className="overlay-vote-card">
          <div className="overlay-vote-heading">
            <span className="eyebrow">
              {forge?.status === "revealed"
                ? "FORGE COMPLETE"
                : forge?.status === "failed"
                  ? "FORGE ENDED"
                  : "THE FORGE IS LISTENING"}
            </span>
            <span className="vote-open">
              <i />
              {category
                ? `VOTE: ${title(category.category)} · ${seconds}s`
                : forge?.status === "revealed"
                  ? "BOSS REVEALED"
                  : forge?.status === "failed"
                    ? "NO WEAKNESS VOTES"
                    : forge?.status === "idle"
                      ? "AWAITING FORGE"
                      : "WAITING TO BEGIN"}
            </span>
          </div>
          <h2>
            {category
              ? `Choose the boss ${category.category === "weakness" ? "weakness" : category.category}`
              : forge?.status === "failed"
                ? "No boss was revealed."
                : forge?.status === "idle"
                  ? "The forge is ready when you are."
                  : "A boss built by the whole chat"}
          </h2>
          <VoteInstructions
            category={category}
            mode={forge?.mode ?? "mock"}
            connectedToTwitch={forge?.connectedToTwitch ?? false}
            surface="overlay"
          />
          {category ? (
            <>
              {(() => {
                const leader = currentVoteLeader(category.options);
                if (!leader) return null;
                return leader.status === "leader" ? (
                  <p className="overlay-leader" aria-live="polite">
                    LEADING RIGHT NOW · {humanizeVoteChoice(leader.choice)} · {leader.count} VOTE
                    {leader.count === 1 ? "" : "S"}
                  </p>
                ) : (
                  <p className="overlay-leader" aria-live="polite">
                    TIED FOR THE LEAD · {leader.count} VOTE{leader.count === 1 ? "" : "S"} EACH
                  </p>
                );
              })()}
              <div className="vote-options">
                {category.options.map((option) => (
                  <div
                    className={category.winner === option.choice ? "winner" : ""}
                    key={option.choice}
                  >
                    <span className="option-glyph">✦</span>
                    <span>{title(option.choice)}</span>
                    <b>
                      {option.percentage}% · {option.count}
                    </b>
                    <i style={{ width: `${option.percentage}%` }} />
                  </div>
                ))}
              </div>
            </>
          ) : reveal ? (
            <div className="overlay-reveal-row">
              {reveal.categories.map((item) => (
                <span key={item.category}>
                  <small>{title(item.category)}</small>
                  <b>{humanizeVoteChoice(item.winner ?? "none")}</b>
                  <em>{winnerAttribution(item.winner, item.noVoteFallback)}</em>
                </span>
              ))}
            </div>
          ) : forge?.status === "failed" ? (
            <p>No valid weakness votes arrived in either voting window.</p>
          ) : forge?.status === "idle" ? (
            <p className="overlay-awaiting-copy">Awaiting the first forge cycle.</p>
          ) : (
            <p>Current vote details are unavailable until fresh server state returns.</p>
          )}
        </section>
      </LiveVoteSurface>
      <div className="overlay-activity">
        <span className="activity-dot" />
        {connection !== "connected"
          ? "SERVER LINK UNAVAILABLE · LIVE VOTE STATUS UNKNOWN"
          : !forge
            ? "WAITING FOR FRESH SERVER STATE · LIVE VOTE STATUS UNKNOWN"
            : forge?.connectedToTwitch
              ? "LIVE TWITCH CHAT · VOTES ARE SERVER AUTHORITATIVE"
              : forge?.simulated
                ? "LOCAL SYNTHETIC CHAT · VOTES ARE SERVER AUTHORITATIVE"
                : "TWITCH DISCONNECTED · LIVE VOTING PAUSED"}
      </div>
      <div className="overlay-safe-label">
        OBS BROWSER SOURCE · RUNS BESIDE YOUR GAME · NO GAME ACCESS
      </div>
    </main>
  );
}
export default function App() {
  if (window.location.pathname.startsWith("/overlay")) return <OverlayPreview />;
  if (window.location.pathname.startsWith("/arena"))
    return (
      <Suspense fallback={<main className="arena-unavailable">Loading arena…</main>}>
        <Arena />
      </Suspense>
    );
  return <Dashboard />;
}
