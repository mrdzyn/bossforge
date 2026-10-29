# Architecture

## Runtime foundation and Phase 1 voting

The workspace contains a React/Vite streamer dashboard and broadcast overlay, a
Fastify server, and a shared TypeScript package. The server listens on
`127.0.0.1:3001` by default; Vite listens on `127.0.0.1:5173` and proxies
`/health`, `/events`, and `/api/*` to it. The UI uses distinct strict versioned public
WebSocket feeds for dashboard activity and overlay state. A development-only
`ForgeSession` owns in-memory vote state, timers, ballots, results, and the
assembled boss. A local state snapshot supports initial load and reconnect.

```text
Mock/Twitch adapter ── NormalizedChatEvent ── ForgeSession (server only)
                                                   │
                                  public state / safe aggregates
                                     ┌─────────────┴─────────────┐
                              dashboard DTO                  OBS DTO
                           strict dashboard WS             strict overlay WS

Streamer dashboard ── local dev POST ── ForgeSession
Synthetic mock chat ── validated vote ── ForgeSession ── state event ── clients
OBS overlay ── read-only presentation of current votes and assembled boss
```

`packages/shared` owns Zod schemas and TypeScript types for normalized chat,
viewer identity, vote commands and session configuration, boss attributes and
stats, battle state, connection state, and versioned application events.

## Responsibilities and lifecycle

- `ChatAdapter` is the provider-neutral boundary. `MockChatAdapter` supplies a
  deterministic local sequence. The Phase 3-B `LiveEventSub` runtime validates
  Twitch notifications and routes them server-side; neither provider exposes
  normalized chat to browsers.
- Local simulation submits bounded synthetic mock events. The server validates
  the normalized event and processes it internally in `ForgeSession`; accepted
  vote changes publish an allowlisted public `forge.state` snapshot.
- The forge runs body, element, special, and weakness votes in order. The server
  starts and closes each timer, keys ballots by stable viewer ID, and computes
  deterministic option-order ties and first-option no-vote fallbacks. The UI
  never decides winners.
- Boss names and bounded statistics are derived from the winning attributes.
  State is memory-only and resets with the development server; combat is not
  implemented.
- Assembly uses the canonical option order as numeric indices. The name is
  `<element epithet> <body epithet>` (for example, storm drake becomes
  `Thunder Tempest`). Health is `120 + 45×bodyIndex + 20×elementIndex`, damage
  is `12 + 4×bodyIndex + 2×elementIndex`, and attack interval is
  `1800 - 150×bodyIndex + 50×elementIndex` milliseconds. Indices start at zero
  in each canonical option list; identical attributes and cycle ID always
  yield identical output. All four attributes also alter the modular artwork.
- Browser messages are parsed against recipient-specific strict public schemas
  before display. Public forge-state DTOs are allowlisted by the server; chat
  content and viewer identity remain server-internal.
- The dashboard owns local start/reset controls and simulated event generation.
  The OBS view is read-only and displays live counts, category, and reveal.

## Twitch integration path

The Phase 3-B runtime uses server-side OAuth and outbound Twitch EventSub as
specified below. It remains local-development only by default and requires the
owner's private configuration and interaction to activate. Tokens remain in
server memory, notifications are schema validated, and normalized chat is never
sent to dashboard or OBS clients. No new game integration or client credential
surface is part of this path.

## Security boundaries

- The default dev server binds to loopback. Simulation routes are registered
  only in explicit development mode, require a loopback peer address regardless
  of the configured bind host, are limited to 20 requests per minute per client
  IP, and accept only `mock` provider events.
- WebSocket subscriptions are development-only until production authentication
  and event authorization exist. Development browser Origins must exactly match
  localhost, 127.0.0.1, or IPv6 loopback at the configured Vite development
  port. Clients without an Origin are accepted only from loopback peers.
- Request bodies and WebSocket frames have an 8 KiB limit. Synthetic event
  payloads are schema validated before internal forge processing.
- The overlay is a separate read-only presentation surface. It does not receive
  administrative controls or secrets.
- Twitch OAuth and EventSub credentials are not needed or present in Phase 0.
- Forge start, reset, state snapshot, and synthetic event routes are development
  only and retain loopback peer, exact local Origin/Fetch Metadata, mock-only,
  and rate-limit protections. State mutation never trusts forwarded IP headers.
- Voting accepts only `!vote <current-category> <declared-choice>` from mock
  events. Supplied parsed command fields and display names are not authoritative;
  message text and stable viewer IDs are checked by the server. Message replay
  IDs are bounded and retained across cycle resets.
- Production access requires authentication and appropriate event
  authorization before WebSocket subscriptions or forge controls are enabled.
- Chat content is untrusted input. It is bounded, schema checked, and rendered
  through React text nodes. It cannot run commands or code.

## Deferred decisions

No database, external service, container, paid API, or production deployment is
introduced. SQLite may be considered only if a later milestone needs persistence.

## Phase 2 local arena

- The dashboard and OBS continue to consume the single `useLiveEvents` hook and
  its shared `ForgeStateReconciler`. The arena route is lazy-loaded so Phaser is
  absent from the main dashboard chunk.
- `/arena` parses the current snapshot with `RevealedForgeStateSchema`. Its game
  identity is bound to server instance, forge cycle, and boss ID. A reset,
  replacement instance, or failed authoritative snapshot tears down the game
  and returns to the unavailable/forge path; stale responses remain subject to
  the same reconciler as the dashboard.
- `packages/shared/src/combat.ts` owns a deterministic fixed-step reducer.
  Phaser supplies movement, pointer/key input, scene rendering, and scene
  lifecycle; boss health/damage/cadence come from the exact forged `Boss`.
  Victory/defeat are local browser state and are not sent to Fastify or persisted.
- `ArenaGame` uses procedural shapes, closes by destroying the Phaser game on
  unmount or identity change, and pauses when the tab is hidden. No combat
  endpoint, networked player input, Twitch credential, or new service was added.

## Phase 3-A offline EventSub integration preparation

- Plan a future **server-side outbound Twitch EventSub WebSocket** for `channel.chat.message` v1. Local hosted bots use WebSocket transport and must use a user access token; OAuth scope/authorized broadcaster and chat-reader pairing require official verification at activation.
- Offline readiness uses synthetic official-shaped messages, a pure EventSub chat normalizer into `NormalizedChatEvent(provider: "twitch")`, a deterministic session state-machine test harness and no real Twitch connection.
- Production Twitch votes **cannot** enter current `ForgeSession` as implemented because it accepts only `mock`. Similarly `ForgeState` is tagged `simulated: true`/`connectedToTwitch: false`, and `forge.state` envelopes have `source: "mock"`. P3-A preserves these invariants. A separate versioned, authenticated provider-mode migration in P3-B is required before live ingestion, to protect identity, session isolation and honest UI labels.
- At the time of P3-A, real integration was blocked pending account registration and separate owner approval. That approval is now recorded in the active [P3-B specification](P3B-LIVE-TWITCH-INTEGRATION.md); P3-A itself remains fixture-only and no behavior was added to its branch.
- The offline `EventSubChatNormalizer` validates `channel.chat.message` v1-shaped packets, bounds the serialized frame and chat text, checks the configured broadcaster, retains Twitch user/message IDs, normalizes EventSub timestamps, rejects replay/out-of-order/stale events, and emits `provider: "twitch"`. It has no socket or network dependency.
- `EventSubSession` is an uninstantiated dependency-injected lifecycle harness. It handles welcome/keepalive, notification callbacks, server-directed reconnect handoff (same configured WSS host, unchanged URL), bounded unexpected-disconnect retry, resubscription planning, revocation, WebSocket control ping/pong, and shutdown. It reports subscription plans through an injected callback; it never sends subscription commands over the WebSocket. Tests use fake transports and timers only.
- Neither component is wired into `createBossForgeApp`, `TwitchChatAdapter`, `ForgeSession`, or an HTTP route. `ForgeSession` still rejects Twitch-provider events, while state remains `simulated: true` and `connectedToTwitch: false`.

## Phase 3-B local Twitch runtime

- `TwitchOAuth` is created disabled unless the app runs in development with
  `TWITCH_INTEGRATION_ENABLED=true`, a Client ID, and a Client Secret. It owns
  short-lived OAuth state and in-memory access/refresh tokens. The fixed local
  callback and streamer controls require loopback peer access; state-changing
  Twitch controls additionally require the HttpOnly browser session, an exact
  permitted local Vite Origin, and same-origin Fetch Metadata.
- `LiveEventSub` owns one outbound `wss://eventsub.wss.twitch.tv/ws` transport.
  It reuses `EventSubSession` and `EventSubChatNormalizer`. A successful welcome
  causes a user-token Helix `channel.chat.message` v1 WebSocket subscription;
  notifications are forwarded only after the matching subscription is verified
  active. Reconnect handoff retains the current receiver; unexpected socket
  loss retries and creates a new subscription. The reader and broadcaster are
  the validated local OAuth identity for this MVP.
- `ForgeState` has a `mode` tag. `source`, state mode and event provider must
  agree; `simulated` reflects mock mode and `connectedToTwitch` reflects the
  verified subscription. `ForgeSession` accepts only its configured provider,
  and Twitch mode rejects events while disconnected. Mode switches allocate a
  new instance identity so browser reconciliation cannot retain an earlier
  provider's state.
- OAuth/Helix requests use injected fetch in tests; WebSocket tests use fake
  sockets. No test contacts Twitch. Tokens are not in React, OBS, EventHub
  payloads, API responses, logs, screenshots, or persistent storage.
- Historical owner-supplied C5-R2 evidence records OAuth/EventSub and three
  accepted genuine ballots; this was not independently reproduced. See
  `docs/ACCEPTANCE.md` for its scope and limitations.

## M1-A outbound privacy boundary

`NormalizedChatEvent` is consumed only inside the server by `ForgeSession` and
the EventSub adapter. `EventHub` accepts forge state, connection state, or safe
dashboard aggregates and builds recipient-specific DTOs. The dashboard and
overlay have distinct strict version-1 envelopes and WebSocket endpoints;
overlay does not receive dashboard activity. A server-side allowlist
projection also protects HTTP forge snapshots and mutation responses. Initial
state is sent directly to the socket that subscribed, avoiding status fan-out.

The dashboard activity projection retains only bounded counts and fixed
rejection buckets. It does not keep message history or viewer identifiers.
Updates are coalesced; forge vote totals remain authoritative in public forge
state. Reset and provider transitions reset activity counters. The `/events`
compatibility route is pinned to dashboard serialization and never accepts a
client-selected recipient.

## M1-B generic presentation states

The dashboard and read-only `/overlay` consume only fresh, reconciled M1-A public
forge and connection projections. A reveal is displayable only when a current
authoritative `ForgeState` passes `RevealedForgeStateSchema`, has a non-null
server-authored boss, a valid cycle ID, all four ordered categories closed, and
a selected winner for each category. The UI does not assemble a boss or infer a
reveal from vote totals, timers, or cached artwork. WebSocket loss invalidates
visible authority immediately; restart/epoch reconciliation adopts the new
server snapshot and never restores an older boss.

The presentation communicates `REVEALED — BATTLE COMING SOON`. It omits
blueprint/Arena health, damage and attack-interval values and contains no battle
state, HP, damage, battle timer, outcome, Start Battle control, or `!hit`
command. OBS remains read-only, credential-free, and game-independent. The
Browser Source can sit alongside a game; it does not inspect, control, or
integrate with that game.

## M2-A server-authoritative battle foundation

`BossBattleSession` is separate from `ForgeSession` and Phaser combat. It only
binds a battle-ready encounter after a validated, complete four-category
`RevealedForgeState`; reveal leaves HP and timers uninitialized. The Generic v1
profile and boss presentation snapshot are copied into strict
`CommunityBattleStateV1`. Only an authorized local owner Start Battle request
selects a 60/90/120-second duration and low/medium/high audience band, chooses
the fixed profile HP, and starts the timer. The server's injected monotonic
clock governs expiry; wall-clock timestamps are descriptive immutable fields.
Cancellation, expiry, victory, and damage transitions serialize synchronously
in the session, and terminal outcomes cannot resume. M2-A has no network damage
or `!hit` route; its bounded M0 command limits are profile data for M2-B.

`GET /battle/state`, `POST /dev/battle/start`, and
`POST /dev/battle/cancel` exist only in the development simulation-enabled
server, require a loopback peer, and return strict no-store state. Mutation
routes require exact local Vite Origin and `Sec-Fetch-Site: same-origin`; Twitch
mode also requires the existing streamer owner session and a verified EventSub
connection for Start Battle. Mock mode remains explicit, credential-free,
loopback-only development. No mock fallback occurs from Twitch mode.

Battle events use the M1-A EventHub recipient-specific projections and strict
versioned schemas. The dashboard receives the validated battle contract,
including the Generic profile snapshot. The OBS projection is narrower: it
contains renderable encounter, boss, timing, HP, aggregate and fixed-cancel
fields, but omits profile identity and processing/tuning configuration. Neither
projection contains chat, viewer identity, pseudonym, message ID, token, cookie,
URL, or free-form error. OBS remains read-only and has no battle admin controls.
`BattleStateReconciler` separately handles battle revisions and
encounter identity; a new server epoch is adopted only from a current-generation
HTTP snapshot, and feed loss hides cached battle state until fresh authority is
re-established.
