import { useCallback, useEffect, useState } from "react";
import { AppEventEnvelopeSchema, type AppEventEnvelope } from "@bossforge/shared";

type Health = {
  status: string;
  service: string;
  version: string;
  connections: { websocketClients: number; mockAdapter: string };
};

function useLiveEvents() {
  const [events, setEvents] = useState<AppEventEnvelope[]>([]);
  const [connection, setConnection] = useState("connecting");
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/health")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Health check returned ${response.status}`);
        return (await response.json()) as Health;
      })
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setError("Server health check is unavailable.");
      });

    const socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/events`,
    );
    socket.addEventListener("open", () => {
      if (active) setConnection("connected");
    });
    socket.addEventListener("close", () => {
      if (active) setConnection("disconnected");
    });
    socket.addEventListener("error", () => {
      if (active) setConnection("error");
    });
    socket.addEventListener("message", (message) => {
      try {
        const envelope = AppEventEnvelopeSchema.parse(JSON.parse(String(message.data)));
        setEvents((current) => [envelope, ...current].slice(0, 8));
      } catch {
        setError("An invalid event was rejected by the browser.");
      }
    });
    return () => {
      active = false;
      socket.close();
    };
  }, []);

  const triggerSimulation = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/dev/simulation/next", { method: "POST" });
      if (!response.ok && response.status !== 204)
        throw new Error(`Simulation returned ${response.status}`);
    } catch {
      setError("Could not reach the local simulation service.");
    }
  }, []);

  return { events, connection, health, error, triggerSimulation };
}

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

function ConnectionPill({ status }: { status: string }) {
  const label = status === "connected" ? "LIVE LINK" : status.toUpperCase();
  return (
    <span className={`connection-pill ${status}`}>
      <i />
      {label}
    </span>
  );
}

function BossArt() {
  return (
    <div
      className="boss-art"
      aria-label="Original placeholder illustration of a fire golem"
      role="img"
    >
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="boss-shadow" />
      <div className="boss-shape">
        <div className="horn horn-left" />
        <div className="horn horn-right" />
        <div className="boss-head">
          <i />
          <i />
          <b />
        </div>
        <div className="boss-body">
          <span />
          <span />
          <b />
        </div>
        <div className="boss-arm arm-left" />
        <div className="boss-arm arm-right" />
        <div className="boss-leg leg-left" />
        <div className="boss-leg leg-right" />
      </div>
      <span className="art-tag tag-top">FORGE ENTITY / 001</span>
      <span className="art-tag tag-bottom">DESIGN IN PROGRESS</span>
    </div>
  );
}

function Sidebar({ overlay = false }: { overlay?: boolean }) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="nav-label">WORKSPACE</div>
      <a className={`nav-item ${overlay ? "" : "active"}`} href="/">
        <span>◈</span> Control room
      </a>
      <a className={`nav-item ${overlay ? "active" : ""}`} href="/overlay">
        <span>▧</span> OBS overlay <small>PREVIEW</small>
      </a>
      <div className="sidebar-bottom">
        <div className="avatar">M</div>
        <div>
          <strong>Local session</strong>
          <span>SIMULATION MODE</span>
        </div>
      </div>
    </aside>
  );
}

function Dashboard() {
  const { events, connection, health, error, triggerSimulation } = useLiveEvents();
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            WORKSPACE <span>/</span> CONTROL ROOM
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <i /> LOCAL SIMULATION
            </span>
            <ConnectionPill status={connection} />
          </div>
        </header>
        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                STREAMER DASHBOARD <span>•</span> PHASE 0
              </p>
              <h1>
                Make something <em>monstrous.</em>
              </h1>
              <p className="subheading">Your chat has the forge. You have the arena.</p>
            </div>
            <button className="primary-button" onClick={() => void triggerSimulation()}>
              <span>✦</span> Generate chat event
            </button>
          </section>

          {error && (
            <div className="inline-error" role="status">
              {error}
            </div>
          )}

          <section className="stat-strip" aria-label="Connection status">
            <div className="stat-card">
              <span className="stat-icon cyan">◎</span>
              <div>
                <span className="stat-label">CHAT CONNECTION</span>
                <strong>{connection === "connected" ? "Connected" : "Waiting for server"}</strong>
              </div>
              <span className="stat-dot" />
            </div>
            <div className="stat-card">
              <span className="stat-icon lime">⌁</span>
              <div>
                <span className="stat-label">SIMULATION</span>
                <strong>Ready to forge</strong>
              </div>
              <span className="stat-value">LOCAL</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon violet">◷</span>
              <div>
                <span className="stat-label">EVENT STREAM</span>
                <strong>
                  {events.filter((event) => event.type === "chat.event").length} recent events
                </strong>
              </div>
              <span className="stat-value">{health?.service ? "ONLINE" : "—"}</span>
            </div>
          </section>

          <section className="workspace-grid">
            <article className="panel boss-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">THE NEXT CHALLENGER</p>
                  <h2>Boss blueprint</h2>
                </div>
                <span className="draft-badge">
                  DRAFT <i />
                </span>
              </div>
              <BossArt />
              <div className="boss-details">
                <div>
                  <span className="detail-label">WORKING NAME</span>
                  <h3>THE CINDER WARDEN</h3>
                </div>
                <div className="level-mark">
                  LVL <b>01</b>
                </div>
              </div>
              <div className="attribute-row">
                <span>
                  ARCHETYPE <b>GOLEM</b>
                </span>
                <span>
                  ELEMENT <b className="fire-text">FIRE</b>
                </span>
                <span>
                  FORMED BY <b>CHAT</b>
                </span>
              </div>
              <div className="progress-label">
                <span>FORGE READINESS</span>
                <span>01 / 04</span>
              </div>
              <div className="progress-track">
                <i />
              </div>
              <p className="placeholder-note">
                Audience voting and boss assembly arrive in Phase 1.
              </p>
            </article>

            <div className="right-stack">
              <article className="panel vote-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">COMMUNITY FORGE</p>
                    <h2>Chat activity</h2>
                  </div>
                  <span className="live-indicator">
                    <i /> LIVE
                  </span>
                </div>
                <div className="event-feed">
                  {events.filter((event) => event.type === "chat.event").length === 0 ? (
                    <div className="feed-empty">
                      <span className="empty-sigil">⌁</span>
                      <strong>Waiting for the first spark</strong>
                      <p>Trigger a local event to see the feed come alive.</p>
                    </div>
                  ) : (
                    events
                      .filter((event) => event.type === "chat.event")
                      .map((event) => <EventRow key={event.id} event={event} />)
                  )}
                </div>
                <div className="feed-footer">
                  <span>LOCAL SIMULATION FEED</span>
                  <span>{connection === "connected" ? "STREAMING" : "RECONNECTING"}</span>
                </div>
              </article>

              <article className="panel controls-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">BATTLE SYSTEM</p>
                    <h2>Ready when you are</h2>
                  </div>
                  <span className="lock-mark">◌</span>
                </div>
                <p className="controls-copy">
                  The arena is being prepared. Your streamer controls will appear here when combat
                  is implemented.
                </p>
                <div className="control-row">
                  <span className="keycap">W</span>
                  <span className="keycap">A</span>
                  <span className="keycap">S</span>
                  <span className="keycap">D</span>
                  <span className="key-description">MOVEMENT</span>
                  <span className="keycap key-wide">SPACE</span>
                  <span className="key-description">ATTACK</span>
                </div>
                <button className="secondary-button" disabled>
                  ENTER ARENA <span>↗</span>
                </button>
              </article>
            </div>
          </section>

          <footer className="page-footer">
            <span>
              BOSSFORGE LIVE <b>•</b> CHAT CREATES THE BOSS. THE STREAMER FIGHTS IT.
            </span>
            <span>
              BUILD 0.1.0 <b>•</b> {health?.status === "ok" ? "SERVER ONLINE" : "SERVER STARTING"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function EventRow({ event }: { event: AppEventEnvelope }) {
  const payload = event.payload;
  const isMessage = payload.kind === "chat.message";
  const name = isMessage ? payload.message.viewer.displayName : "EmberFan";
  const text = isMessage
    ? payload.message.text
    : payload.kind === "viewer.connected"
      ? "joined the forge"
      : "left the forge";
  const isVote = isMessage && Boolean(payload.message.command);
  return (
    <div className="event-row">
      <span className={`event-avatar ${isVote ? "vote" : ""}`}>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="event-copy">
        <strong>{name}</strong>
        <span>{text}</span>
      </div>
      {isVote && <span className="vote-tag">VOTE</span>}
      <time>
        {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
    </div>
  );
}

function OverlayPreview() {
  const { events, connection } = useLiveEvents();
  const latest = events.find((event) => event.payload.kind === "chat.message");
  const latestMessage =
    latest?.payload.kind === "chat.message" ? latest.payload.message : undefined;
  return (
    <div className="overlay-page">
      <div className="overlay-topline">
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
            <i /> SIMULATION
          </span>
          <span>
            ROUND 01 <b>•</b> THE FORGE AWAKENS
          </span>
        </div>
      </div>
      <div className="overlay-boss-card">
        <div className="overlay-boss-art">
          <div className="mini-golem">
            <i />
            <i />
            <b />
          </div>
        </div>
        <div className="overlay-boss-info">
          <span className="eyebrow">THE CHAT HAS FORGED</span>
          <h1>THE CINDER WARDEN</h1>
          <div className="boss-tags">
            <span>GOLEM</span>
            <span className="fire-text">FIREBOUND</span>
          </div>
          <div className="health-label">
            <span>BOSS VITALITY</span>
            <b>100%</b>
          </div>
          <div className="health-track">
            <i />
          </div>
        </div>
      </div>
      <div className="overlay-vote-card">
        <div className="overlay-vote-heading">
          <span className="eyebrow">THE FORGE IS LISTENING</span>
          <span className="vote-open">
            <i /> VOTING OPENS IN PHASE 1
          </span>
        </div>
        <h2>What should the boss wield?</h2>
        <div className="vote-options">
          <div>
            <span className="option-glyph fire-text">✦</span>
            <span>EMBER</span>
            <b>—</b>
          </div>
          <div>
            <span className="option-glyph">❄</span>
            <span>FROST</span>
            <b>—</b>
          </div>
          <div>
            <span className="option-glyph">ϟ</span>
            <span>STORM</span>
            <b>—</b>
          </div>
        </div>
      </div>
      <div className="overlay-activity">
        <span className="activity-dot" />
        <span>
          {latestMessage
            ? `${latestMessage.viewer.displayName}: ${latestMessage.text}`
            : connection === "connected"
              ? "Chat is connected to the local simulation"
              : "Waiting for local event stream"}
        </span>
      </div>
      <div className="overlay-safe-label">
        BROADCAST OVERLAY PREVIEW <b>•</b> 1920 × 1080 SAFE LAYOUT
      </div>
    </div>
  );
}

export default function App() {
  const isOverlay = window.location.pathname.startsWith("/overlay");
  return isOverlay ? <OverlayPreview /> : <Dashboard />;
}
