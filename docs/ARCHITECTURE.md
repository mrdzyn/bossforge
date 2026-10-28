# Architecture

## Runtime foundation and Phase 1 voting

The workspace contains a React/Vite streamer dashboard and broadcast overlay, a
Fastify server, and a shared TypeScript package. The server listens on
`127.0.0.1:3001` by default; Vite listens on `127.0.0.1:5173` and proxies
`/health`, `/events`, and `/api/*` to it. The UI uses a shared versioned
WebSocket feed for dashboard activity and overlay state. A development-only
`ForgeSession` owns in-memory vote state, timers, ballots, results, and the
assembled boss. A local state snapshot supports initial load and reconnect.

```text
MockChatAdapter ── normalized chat event ── EventHub ── WebSocket ── browser
                                              │
                                       versioned envelope

Streamer dashboard ── local dev POST ── ForgeSession
Synthetic mock chat ── validated vote ── ForgeSession ── state event ── clients
OBS overlay ── read-only presentation of current votes and assembled boss
```

`packages/shared` owns Zod schemas and TypeScript types for normalized chat,
viewer identity, vote commands and session configuration, boss attributes and
stats, battle state, connection state, and versioned application events.

## Responsibilities and lifecycle

- `ChatAdapter` is the provider-neutral boundary. `MockChatAdapter` supplies a
  deterministic four-event local sequence. `TwitchChatAdapter` is an explicit
  Phase 0 stub and does not connect to Twitch.
- Local simulation requests ask the mock adapter for an event or submit a
  bounded synthetic mock event. The server validates and publishes the chat
  envelope, then evaluates it in `ForgeSession`. Accepted vote changes publish
  a full versioned `forge.state` snapshot.
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
- Browser messages are parsed against the same shared envelope schema before
  display. Chat text is rendered as text, never injected HTML.
- The dashboard owns local start/reset controls and simulated event generation.
  The OBS view is read-only and displays live counts, category, and reveal.

## Twitch integration path

When account registration is available, a server-side adapter can translate
official Twitch EventSub chat messages into `NormalizedChatEvent`. OAuth state
validation, least-privilege authorization, exact redirect URI matching, secure
server-side token storage, and connection revocation handling belong in that
future implementation. Twitch formats must not leak into game services.

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
  payloads are schema validated before publication.
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
- Real OAuth consent, EventSub connectivity and channel voting remain untested
  until the owner applies private configuration and initiates local consent.

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
