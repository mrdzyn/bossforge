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
