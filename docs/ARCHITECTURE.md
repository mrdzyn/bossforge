# Architecture

## Phase 0 runtime

The workspace contains a React/Vite streamer dashboard and broadcast overlay, a
Fastify server, and a shared TypeScript package. The server listens on
`127.0.0.1:3001` by default; Vite listens on `127.0.0.1:5173` and proxies
`/health`, `/events`, and `/api/*` to it. The UI uses one shared WebSocket feed
for both dashboard activity and the overlay preview.

```text
MockChatAdapter ── normalized chat event ── EventHub ── WebSocket ── browser
                                              │
                                       versioned envelope

Streamer dashboard ── local dev POST ── MockChatAdapter
OBS overlay preview ── read-only presentation of the same event feed
```

`packages/shared` owns Zod schemas and TypeScript types for normalized chat,
viewer identity, vote commands and session configuration, boss attributes and
stats, battle state, connection state, and versioned application events.

## Responsibilities and lifecycle

- `ChatAdapter` is the provider-neutral boundary. `MockChatAdapter` supplies a
  deterministic four-event local sequence. `TwitchChatAdapter` is an explicit
  Phase 0 stub and does not connect to Twitch.
- A local simulation request asks the mock adapter for its next event. The
  server validates it, wraps it in a schema version 1 envelope with a UUID and
  timestamp, validates the envelope, then publishes it to connected clients.
- Browser messages are parsed against the same shared envelope schema before
  display. Chat text is rendered as text, never injected HTML.
- The dashboard owns local development controls. The overlay shows only boss,
  voting placeholder, and event activity content; it contains no admin controls
  or credentials.
- Voting, boss assembly, and battle schemas define future boundaries. Their
  gameplay behavior is not part of Phase 0.

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
- Chat content is untrusted input. It is bounded, schema checked, and rendered
  through React text nodes. It cannot run commands or code.

## Deferred decisions

No database, external service, container, paid API, or production deployment is
introduced. SQLite may be considered only if a later milestone needs persistence.
