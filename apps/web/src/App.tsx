import { lazy, Suspense, useEffect, useState } from "react";
import {
  currentVoteLeader,
  humanizeVoteChoice,
  remainingVoteSeconds,
  type ForgeState,
  winnerAttribution,
} from "@bossforge/shared";
import { useLiveEvents } from "./hooks/useLiveEvents.js";
import { FORGE_DURATIONS, forgeCountdownLabel, type ForgeDuration } from "./live-forge-ui.js";
import { VoteInstructions } from "./VoteInstructions.js";

const Arena = lazy(() => import("./arena/Arena.js"));

function Brand() {
  return (
    <a className="brand" href="/" aria-label="BossForge dashboard">
      <span className="brand-mark">
        B<span>F</span>
      </span>
      <span className="brand-name">
        BOSSFORGE<span>LIVE</span>
      </span>
    </a>
  );
}
function Sidebar({
  overlay = false,
  mode = "mock",
}: {
  overlay?: boolean;
  mode?: "mock" | "twitch";
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
          <span>{mode === "mock" ? "SIMULATION MODE" : "TWITCH MODE"}</span>
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

function BossArt({ state }: { state: ForgeState | null }) {
  const attrs = state?.boss?.attributes;
  const body =
    attrs?.body ?? state?.categories.find((item) => item.category === "body")?.winner ?? "golem";
  const element =
    attrs?.element ??
    state?.categories.find((item) => item.category === "element")?.winner ??
    "fire";
  const special =
    attrs?.special ??
    state?.categories.find((item) => item.category === "special")?.winner ??
    "ember-burst";
  const weakness =
    attrs?.weakness ??
    state?.categories.find((item) => item.category === "weakness")?.winner ??
    "water";
  const specialStyle =
    special === "frost-chain"
      ? "chain"
      : special === "thunder-dash"
        ? "thunder"
        : special === "shadow-pulse"
          ? "shadow"
          : "ember";
  const specialGlyph =
    special === "frost-chain"
      ? "⛓"
      : special === "thunder-dash"
        ? "ϟ"
        : special === "shadow-pulse"
          ? "◉"
          : "✹";
  const weaknessGlyph =
    weakness === "water" ? "◉" : weakness === "light" ? "✧" : weakness === "earth" ? "⬟" : "〰";
  return (
    <div
      className={`boss-art body-${body} element-${element} special-${specialStyle} weakness-${weakness}`}
      role="img"
      aria-label={`${title(body)} ${title(element)} boss, ${title(special)} special, weak to ${title(weakness)}`}
    >
      <div className="art-aura" />
      <div className="boss-figure">
        <div className="boss-horns">
          <i />
          <i />
        </div>
        <div className="boss-head">
          <i />
          <i />
          <b />
        </div>
        <div className="boss-torso">
          <i />
          <i />
          <b />
        </div>
        <div className="boss-limbs">
          <i />
          <i />
          <b />
          <b />
        </div>
      </div>
      <span className="art-tag tag-top">FORGE ENTITY / {state?.cycleId ?? "AWAITING VOTES"}</span>
      <span className="art-tag tag-bottom">
        {title(body)} · {title(element)}
      </span>
      <span className="special-mark" aria-hidden="true">
        {specialGlyph}
      </span>
      <span className="weakness-mark" aria-hidden="true">
        {weaknessGlyph}
      </span>
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

function Dashboard() {
  const { events, forge, connection, error, notice, post } = useLiveEvents();
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
  return (
    <div className="app-shell">
      <Sidebar mode={forge?.mode ?? "mock"} />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            WORKSPACE <span>/</span> CONTROL ROOM
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <i />{" "}
              {forge?.connectedToTwitch
                ? "TWITCH CONNECTED"
                : forge?.mode === "twitch"
                  ? "TWITCH DISCONNECTED"
                  : "SIMULATED"}
            </span>
            <Connection status={connection} />
          </div>
        </header>
        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                STREAMER DASHBOARD <span>•</span>{" "}
                {forge?.mode === "twitch" ? "LIVE TWITCH" : "SIMULATED"}
              </p>
              <h1>
                Make something <em>monstrous.</em>
              </h1>
              <p className="subheading">Four timed votes. One boss forged by chat.</p>
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
                  forge?.status === "voting" ||
                  (forge?.mode === "twitch" && !forge.connectedToTwitch)
                }
                onClick={async () => {
                  if (isRevealed && !(await post("/api/dev/forge/reset"))) return;
                  await post("/api/dev/forge/start", { durationSeconds });
                }}
              >
                {isRevealed ? "✦ Forge again" : "✦ Start the forge"}
              </button>
              {forge?.status !== "idle" && (
                <button
                  className="secondary-button"
                  onClick={() => void post("/api/dev/forge/reset")}
                >
                  Reset cycle
                </button>
              )}
              {isRevealed && (
                <a className="secondary-button arena-entry" href="/arena">
                  ⚔ Enter Arena
                </a>
              )}
            </div>
          </section>
          <section className="panel twitch-controls" aria-label="Twitch connection controls">
            <div>
              <p className="eyebrow">LOCAL TWITCH INTEGRATION</p>
              <strong>
                {twitch?.identity
                  ? `${twitch.identity.displayName} (@${twitch.identity.login}) · ${twitch.connected ? "TWITCH CONNECTED" : twitch.status.toUpperCase()}`
                  : twitch?.configured
                    ? "Not authenticated"
                    : "Not configured · SIMULATED mode remains available"}
              </strong>
            </div>
            {!twitch?.identity ? (
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
                  disabled={diagnosticsLoading}
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
          <section className="stat-strip">
            <div className="stat-card">
              <span className="stat-icon cyan">◎</span>
              <div>
                <span className="stat-label">CHAT CONNECTION</span>
                <strong>
                  {forge?.connectedToTwitch
                    ? "Twitch chat connected"
                    : forge?.mode === "twitch"
                      ? "Twitch chat disconnected"
                      : connection === "connected"
                        ? "Local simulated chat"
                        : "Reconnecting"}
                </strong>
              </div>
              <Connection status={connection} />
            </div>
            <div className="stat-card">
              <span className="stat-icon lime">⌁</span>
              <div>
                <span className="stat-label">FORGE STATUS</span>
                <strong>
                  {forge?.status === "voting"
                    ? `Voting · ${title(forge.activeCategory ?? "")}`
                    : isRevealed
                      ? "Boss revealed"
                      : "Ready to forge"}
                </strong>
              </div>
              <span className="stat-value">{forge?.progress ?? 0} / 4</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon violet">◷</span>
              <div>
                <span className="stat-label">ACTIVE VOTES</span>
                <strong>
                  {activeCategory?.totalVotes ??
                    forge?.categories.reduce((total, item) => total + item.totalVotes, 0) ??
                    0}{" "}
                  votes cast
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
            <article className="panel boss-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    {isRevealed ? "THE CHAT HAS FORGED" : "THE NEXT CHALLENGER"}
                  </p>
                  <h2>{isRevealed ? forge?.boss?.name : "Boss blueprint"}</h2>
                </div>
                <span className={`draft-badge ${isRevealed ? "revealed" : ""}`}>
                  {isRevealed ? "REVEALED" : forge?.status === "voting" ? "IN PROGRESS" : "READY"}{" "}
                  <i />
                </span>
              </div>
              <BossArt state={forge} />
              {forge?.boss && (
                <div className="boss-details">
                  <div>
                    <span className="detail-label">FORGED NAME</span>
                    <h3>{forge.boss.name}</h3>
                  </div>
                  <div className="level-mark">
                    HP <b>{forge.boss.stats.health}</b>
                  </div>
                </div>
              )}
              <div className="attribute-row">
                <span>
                  BODY{" "}
                  <b>
                    {title(forge?.boss?.attributes.body ?? forge?.categories[0]?.winner ?? "TBD")}
                  </b>
                </span>
                <span>
                  ELEMENT{" "}
                  <b className="fire-text">
                    {title(
                      forge?.boss?.attributes.element ?? forge?.categories[1]?.winner ?? "TBD",
                    )}
                  </b>
                </span>
                <span>
                  WEAKNESS{" "}
                  <b>
                    {title(
                      forge?.boss?.attributes.weakness ?? forge?.categories[3]?.winner ?? "TBD",
                    )}
                  </b>
                </span>
              </div>
              <div className="progress-label">
                <span>FORGE PROGRESS</span>
                <span>{forge?.progress ?? 0} / 4</span>
              </div>
              <div className="progress-track">
                <i style={{ width: `${((forge?.progress ?? 0) / 4) * 100}%` }} />
              </div>
              {forge?.boss && (
                <p className="boss-stats">
                  {forge.boss.attributes.special.toUpperCase()} · {forge.boss.stats.damage} DMG ·{" "}
                  {forge.boss.stats.attackIntervalMs} MS ATTACK
                </p>
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
                    {forge?.status === "voting" && forge.activeCategory
                      ? forgeCountdownLabel(forge.activeCategory, seconds)
                      : isRevealed
                        ? "COMPLETE"
                        : "READY"}
                  </span>
                </div>
                {forge ? (
                  <CategoryResults state={forge} />
                ) : (
                  <p className="muted">Connecting to local forge state…</p>
                )}
              </article>
              <article className="panel controls-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">
                      {forge?.mode === "twitch" ? "LIVE TWITCH CHAT" : "SIMULATION FEED"}
                    </p>
                    <h2>Recent chat</h2>
                  </div>
                  {forge?.mode !== "twitch" && (
                    <button
                      className="text-button"
                      onClick={() => void post("/api/dev/simulation/next")}
                    >
                      Generate event
                    </button>
                  )}
                </div>
                <div className="event-feed">
                  {events
                    .filter((event) => event.type === "chat.event")
                    .slice(0, 4)
                    .map((event) => {
                      const p = event.payload;
                      return (
                        <div className="event-row" key={event.id}>
                          <span className="event-avatar">
                            {p.kind === "chat.message" ? p.message.viewer.displayName[0] : "•"}
                          </span>
                          <div className="event-copy">
                            <strong>
                              {p.kind === "chat.message"
                                ? p.message.viewer.displayName
                                : "Mock viewer"}
                            </strong>
                            <span>{p.kind === "chat.message" ? p.message.text : p.kind}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </article>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              BOSSFORGE LIVE <b>•</b> CHAT CREATES THE BOSS.
            </span>
            <span>
              {forge?.connectedToTwitch
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

function OverlayPreview() {
  const { forge, connection } = useLiveEvents();
  const category =
    forge?.status === "voting"
      ? (forge.categories.find((item) => item.category === forge.activeCategory) ?? null)
      : null;
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
          <span className="brand-mark">
            B<span>F</span>
          </span>
          <span>
            BOSSFORGE <b>LIVE</b>
          </span>
        </div>
        <div className="overlay-round">
          <span className="round-live">
            <i />
            {forge?.connectedToTwitch
              ? "LIVE TWITCH"
              : forge?.mode === "mock"
                ? "SIMULATED / NOT CONNECTED TO TWITCH"
                : "TWITCH DISCONNECTED / VOTING PAUSED"}
          </span>
          <span>
            {forge?.cycleId?.toUpperCase() ?? "AWAITING FORGE"} <b>•</b> {connection.toUpperCase()}
          </span>
        </div>
      </header>
      <section className="overlay-boss-card">
        <div className="overlay-boss-art">
          <BossArt state={forge} />
        </div>
        <div className="overlay-boss-info">
          <span className="eyebrow">
            {forge?.status === "revealed" ? "THE COMMUNITY FORGED" : "THE CHAT IS FORGING"}
          </span>
          <h1>{forge?.boss?.name ?? "A NEW BOSS AWAITS"}</h1>
          <div className="boss-tags">
            <span>{title(forge?.boss?.attributes.body ?? "BODY TBD")}</span>
            <span>{title(forge?.boss?.attributes.element ?? "ELEMENT TBD")}</span>
          </div>
          {forge?.boss && (
            <div className="overlay-stats">
              {forge.boss.stats.health} HP <b>·</b> {forge.boss.stats.damage} DMG
            </div>
          )}
        </div>
      </section>
      <section className="overlay-vote-card">
        <div className="overlay-vote-heading">
          <span className="eyebrow">
            {forge?.status === "revealed" ? "FORGE COMPLETE" : "THE FORGE IS LISTENING"}
          </span>
          <span className="vote-open">
            <i />
            {category
              ? `VOTE: ${title(category.category)} · ${seconds}s`
              : forge?.status === "revealed"
                ? "BOSS REVEALED"
                : "WAITING TO BEGIN"}
          </span>
        </div>
        <h2>
          {category
            ? `Choose the boss ${category.category === "weakness" ? "weakness" : category.category}`
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
        ) : forge ? (
          <div className="overlay-reveal-row">
            {forge.categories.map((item) => (
              <span key={item.category}>
                {title(item.category)} <b>{humanizeVoteChoice(item.winner ?? "none")}</b>
                {item.winner && ` · ${winnerAttribution(item.winner, item.noVoteFallback)}`}
              </span>
            ))}
          </div>
        ) : (
          <p>Connect to the local development server to see votes.</p>
        )}
      </section>
      <div className="overlay-activity">
        <span className="activity-dot" />
        {forge?.connectedToTwitch
          ? "LIVE TWITCH CHAT · VOTES ARE SERVER AUTHORITATIVE"
          : forge?.simulated
            ? "LOCAL SYNTHETIC CHAT · VOTES ARE SERVER AUTHORITATIVE"
            : "TWITCH DISCONNECTED · LIVE VOTING PAUSED"}
      </div>
      <div className="overlay-safe-label">
        BROADCAST OVERLAY <b>•</b> SAFE AREA
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
