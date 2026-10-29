# Security notes

## M1-A public event privacy boundary

- `NormalizedChatEvent` is an internal server contract. Do not add it to any
  browser event schema or publish it through `EventHub`.
- Dashboard events use `DashboardEventEnvelopeSchema`; OBS events use the
  smaller `OverlayEventEnvelopeSchema`. Both families are versioned, strict,
  and reject unknown fields at every nested public object. Build outbound DTOs
  explicitly on the server and validate with the recipient schema immediately
  before serialization and send.
- Dashboard may receive forge state, public connection state, bounded
  aggregate activity with fixed reason codes, and strict M2-A battle state.
  OBS receives forge, connection, and the privacy-safe battle projection, but
  no dashboard activity or administration controls. Recipient selection is fixed by `/events/dashboard` or
  `/events/overlay`; query parameters or client-supplied roles never authorize
  routing. The legacy `/events` path is dashboard-only and has the same strict
  boundary.
- Do not publish a chat event to browser clients, including mock simulation.
  Do not retain viewer activity history for UI display. HTTP forge snapshots,
  start/reset responses, diagnostics, and logs must use allowlisted data and
  must not include viewer identity, message identifiers/text, OAuth data,
  cookies, or full provider error objects.
- Aggregate counts saturate at a fixed bound and reset on forge-cycle,
  provider-mode, disconnect, and reset lifecycle transitions. EventSub
  diagnostics use fixed classifications and bounded counters. Connection
  subscriptions receive initial state only on their own socket.

## Development-mode boundaries (Phase 0 and Phase 1)

- No real credentials or Twitch tokens belong in the repository, browser bundle,
  screenshots, event payloads, or logs.
- Phase 0 does not request Twitch credentials. The Twitch adapter is a stub.
- Local mock identities and chat text are synthetic and untrusted. Validate
  inputs, enforce bounded payloads, and render messages as plain text.
- Do not let chat content run commands, HTML, or code.
- Keep the local development service bound to loopback by default. Forge start,
  reset, state snapshot, and simulation routes exist only in explicit
  development mode, require a loopback peer even if the server bind host
  changes, accept only `mock` provider events, and are limited to 20 requests
  per minute per client IP. They must remain absent in `NODE_ENV=production`.
- Vite's development server must bind only to a loopback address. Validate the
  final resolved server host after config, environment, and CLI options are
  merged, before binding. Reject wildcard and other externally reachable hosts,
  including CLI `--host` overrides. Simulation POSTs must have either no Origin
  from a loopback CLI client or an exact permitted
  local Vite Origin. When `Sec-Fetch-Site` is present, accept only
  `same-origin`. Determine locality from the socket peer address; never use
  `X-Forwarded-For` or another client-supplied forwarding header for access
  authorization.
- Development WebSocket subscriptions must restrict browser Origins to the
  explicit local Vite origin allowlist and require a loopback peer. Production
  WebSocket access requires authentication and appropriate event authorization
  before it is enabled.
- The overlay is read-only and must not include streamer administration or
  secret values.
- Only server-validated `!vote <category> <choice>` text from mock chat can
  affect the active vote. Ballots use stable viewer IDs, not display names;
  duplicate message IDs, invalid choices, wrong-category, stale, future, and
  late events cannot change state. Each viewer has one mutable ballot per
  category. These checks are not authentication for public/production use.
- Production event access requires authentication and appropriate event
  authorization. Phase 1 adds no Twitch connection or remote voting access.

## Future Twitch OAuth/EventSub requirements

Use official Twitch APIs. Validate OAuth state and exact redirect URIs, request
the minimum chat scopes, keep tokens server-side in protected storage, avoid
logging authorization headers, handle revocation and reconnects, validate all
EventSub data, and never trust chat text as an instruction to the application
or coding agent.

### P3-A offline-only boundary

- P3-A parses synthetic, official-shaped EventSub fixtures only. The normalizer
  and lifecycle harness are not wired to the application server or forge and
  contain no Twitch socket, HTTP client, OAuth flow, credential lookup, or
  subscription management.
- The normalizer bounds serialized packets and chat text; validates v1 message
  type, both the configured broadcaster and authorized chat-reader IDs in the
  subscription condition, stable chatter ID, timestamp, and message ID; and
  rejects malformed, wrong-channel/reader, stale/future, out-of-order, and
  replayed messages. Text stays ordinary untrusted chat text.
- The official chat subscription condition contains both the configured
  broadcaster ID and an explicitly configured authorized chat-reader ID. The
  latter is validated against the fixture condition; the chatter ID remains the
  actual viewer identity in the normalized event.
- The injected lifecycle harness consumes frames from a caller-supplied fake
  transport. Reconnect URLs must use `wss:`, match the configured host, and
  contain no user information; the URL is passed unchanged to the injected
  factory. Tests use a reserved `.invalid` fixture host only. The harness
  reports subscription plans to a callback and does not send subscription JSON
  over the WebSocket. Notifications require a successful welcome for their
  transport and an accepting validation callback; only valid welcome, keepalive,
  or accepted notification messages refresh the EventSub deadline. Control
  Ping is answered with Pong without changing that deadline. Malformed frames,
  rejected notifications, duplicate activity, and stale/closed/revoked sockets
  do not renew deadlines or forward notifications.
- Do not connect this harness to a real transport or feed normalized Twitch
  events to `ForgeSession` in P3-A. Forge events remain mock-sourced and
  `simulated: true` / `connectedToTwitch: false`; P3-B requires separate owner
  approval and an independently reviewed provider-mode migration.

## Not in scope

No payments, unsolicited chat posting, user tracking, production deployment,
production account storage, Twitch authentication, or playable combat is
introduced in Phase 1.

## Phase 3-B — authorized local live integration security gates

- Owner has explicitly authorized **development** of server-side OAuth and actual Twitch chat connection; this does **not** authorize production exposure, merge or deployment. P3-A remains offline until the P3-B implementation is complete and tested.
- Twitch app Client ID must be environment-configurable, not hardcoded; Client Secret, user access/refresh tokens, OAuth code and state must never enter GitHub, browser bundles, logs, screenshots or chat. Local MVP tokens are process-memory only and logout/restart must clear them.
- Registered/intended redirect `http://localhost:3001/auth/twitch/callback`; exact match and loopback/Host validation are required. Browser callback is a top-level cross-site GET, so bind a high-entropy single-use `state` to the initiating browser, short expiry, cookie `HttpOnly; SameSite=Lax` or equivalent, and reject callback spoofing, replay, denial and mismatches.
- Twitch `/oauth2/validate` is required at startup and at least hourly; only accept the right Client ID, numeric user identity and `user:read:chat` scope. Refresh/rotate tokens securely and fail closed on 401/revocation. Twitch WS subscriptions require **user** access tokens and verified `session_id`; create `channel.chat.message` v1 using `broadcaster_user_id` and authenticated `user_id`. Outbound WSS only, no public webhook.
- OAuth/session/forge mode operations are authorized **local streamer controls**, not unprotected loopback mutations. Apply browser-bound owner session controls plus CSRF/Origin protection; do not bypass Phase 0 effective-host, socket-peer, Origin, rate limit and production restrictions. OBS must have no auth controls or tokens.
- Real-mode votes and mock-mode votes must be mutually exclusive per forge cycle and marked accurately. The P3-B source-aware state migration enforces this provider boundary.
- Control Ping/Pong must not reset application keepalive; no real notification may be forwarded until verified welcome and active Helix subscription. Never infer `connectedToTwitch` from a local browser socket.
- Owner must opt in to local OAuth authorization and provide the secret through private local configuration. Never force browser login or make real Twitch API calls in tests. **Owner-supplied C5-R2 live QA:** OAuth/EventSub PASS; 1 valid welcome, 1 enabled Helix subscription, 11 keepalives at a 30,000 ms advertised timeout, 6 accepted notifications, 6 normalized messages and 6 chat callbacks. Three genuine ballots were accepted and three rejected (1 `wrong-category`, 2 `invalid-choice`); keepalive disconnects, socket closes/errors and forge cancellations: 0. The four-stage forge revealed Cinder Granite (Golem / Fire / Ember Burst default / Earth); Special used its no-vote default, so acceptance in all categories is not claimed. Phaser result was VICTORY (boss 0/120 HP; streamer 64/100 HP). These results were supplied by the owner, not independently reproduced; actual OBS application capture remains **UNVERIFIED**. Automated fake-network results are separate: 124 tests passed at implementation commit `279ff63fc803921310226d9c6903a029af7f0bd5`.
- Full [active implementation and test gates](P3B-LIVE-TWITCH-INTEGRATION.md).

## Phase 4-A — voting presentation boundary

The dashboard and OBS overlay display server-authoritative vote state and
canonical command text. Overlay content does not submit votes or expose forge
administration, OAuth controls, credentials, chat identities, or diagnostic
data. Live commands appear only while the authoritative state reports a
verified Twitch connection and an open category. Simulation and disconnected
states do not imply live voting. No voting intake, OAuth, EventSub, route,
listener, or authorization boundary changed in Phase 4-A. Chromium screenshots
are browser evidence only; actual OBS capture remains unverified.

### P3-B implementation status

- The implementation uses `TWITCH_INTEGRATION_ENABLED=true` only in
  development and still requires both Client ID and Client Secret. Missing
  configuration leaves OAuth disabled; no browser action automatically starts
  consent or contacts Twitch.
- OAuth uses the exact `localhost:3001` callback, one-time state bound to an
  HttpOnly SameSite=Lax cookie, loopback peer and exact Host checks, then
  validates the returned client, numeric account ID and minimum scope. Tokens
  stay in process memory, refresh tokens rotate, validation runs hourly, and
  logout/revocation invalidates local access. Auth responses are no-store and
  return no tokens or authorization codes to the frontend.
- Twitch mode changes shared event/state provenance to `twitch`; it does not
  relabel real messages as mock. The EventSub adapter requires a welcomed
  transport and verified enabled Helix subscription before forwarding. It
  validates channel, reader, type/version, timestamp and replay through the
  P3-A normalizer/session code. Revocation/disconnect disables the intake and
  cancels any active voting cycle.
- Twitch-mode start/reset/connect/disconnect/mode-switch controls require the
  process-memory OAuth session plus exact local Origin and Fetch Metadata.
  Loopback peer checks remain in force. Mock event-generation/injection
  endpoints are rejected while a Twitch forge is selected; authenticated live
  start/reset controls remain available. OBS receives only provider mode,
  verified connection status and forge state, never credentials or controls.
- B1/B2/B3 automated tests use fake fetch responses and fake WSS sockets;
  this evidence is not proof of live service operation. Separate owner-supplied
  C5-R2 live QA observed genuine notifications and ballots, as summarized above
  and detailed in [acceptance evidence](ACCEPTANCE.md#p3-b4-c5-r2--eventsub-keepalive-remediation).
- P3-B-C2 scopes disconnect/error state to the current socket and invalidates
  Helix verification when the welcomed EventSub session changes. Deferred fake
  HTTP tests cover stale success, HTTP 409 verification, and request failure.
- Forge replacements advance `serverStartedAt` monotonically, rotate
  `serverInstanceId`, and publish the authoritative transition snapshot. The
  C5 backend-restart guard remains active and delayed previous-mode snapshots
  are rejected. Authenticated logout clears the Twitch cookie and restores a
  fresh mock forge so local simulation remains available.
- Local auth-start and callback preflight used synthetic credentials with
  `TWITCH_INTEGRATION_ENABLED=false`. The server returned disabled/invalid
  responses without contacting Twitch. See [C2 acceptance evidence](ACCEPTANCE.md#p3-b-c2--bounded-remediation-of-independent-c1-findings).
- P3-B-C3 routes verified EventSub session loss, including internal keepalive
  expiry, through the adapter's authoritative loss callback. It clears stale
  subscription verification, stops Twitch intake, reports disconnected retry
  state, and cancels an active Twitch cycle. Welcome and revocation state is
  committed only after lifecycle validation; malformed frames cannot poison a
  welcomed session. Fake scheduler/socket tests cover timeout without a close
  event and malformed-then-valid sequences. No live Twitch network was used.
  See [C3 acceptance evidence](ACCEPTANCE.md#p3-b-c3--bounded-remediation-of-c2-findings).
- P3-B-C4 preserves the adapter's active transport identity until the lifecycle
  disconnect handler reports verified session loss. This lets unexpected
  active socket close/error invalidate Helix verification and publish
  disconnected retry state immediately; the forge cancels Twitch voting. A
  retired transport remains unable to affect its successor. Fake-socket tests
  cover close, error-then-close, current/retired transports, and fresh Helix
  verification after reconnect. No live Twitch traffic was used. See
  [C4 acceptance evidence](ACCEPTANCE.md#p3-b-c4--bounded-remediation-of-c3-01).

### P3-B4-C5 diagnostic containment

- EventSub diagnostics are opt-in (`BOSSFORGE_EVENTSUB_DIAGNOSTICS=true`),
  development-only, in-memory, and disabled by default. When enabled, the
  read-only `POST /dev/twitch/diagnostics` route is exposed only in the
  development server. It requires a loopback peer, allowed same-origin Origin,
  `Sec-Fetch-Site: same-origin`, and authenticated Twitch owner session. It
  returns `Cache-Control: no-store`; no diagnostic route or data is added to
  OBS. The dashboard's owner-visible **Read local EventSub diagnostics** button
  performs this POST; address-bar GET is not supported.
- Recorded fields are fixed counters/reason enums, numeric WebSocket close
  codes, allowlisted socket error classes, and relative millisecond timings.
  The implementation stores no raw frames, chat text, usernames, viewer or
  session IDs, URLs, OAuth data, cookies, secrets, or full error objects.
- The active authenticated runtime was not restarted to activate diagnostics.
  No diagnostics were observed from the real disconnect, so its root cause
  remains unknown. See [C5 evidence](ACCEPTANCE.md#p3-b4-c5--eventsub-disconnect-investigation).

## M2-A battle authority and local routes

- `CommunityBattleStateV1` is a strict versioned contract separate from the
  Phaser `BattleStateSchema`. It contains only a server epoch/revision,
  encounter and forge-cycle identities, immutable boss and Generic profile
  snapshots, selected band/duration, timestamps, HP, aggregate counters and a
  fixed cancellation reason. It has no viewer, chat, pseudonym, message ID,
  token, cookie, URL or free-form error fields.
- `BossBattleSession` binds one encounter to a fully validated four-stage
  server reveal. Reveal creates `ready` without HP or a timer. Only the owner
  Start Battle operation creates `active`; deadline, cancellation, victory and
  expiry are serialized and terminal state cannot resume. M2-A has no damage
  endpoint or chat-hit routing. The internal damage test seam is not routed or
  exposed to browsers.
- Battle routes are development-only and simulation-enabled. Snapshot access
  requires loopback. Mutations require loopback, an exact allowed local Vite
  Origin and `Sec-Fetch-Site: same-origin`; Twitch mode additionally requires
  the existing owner session. Start also requires a verified EventSub-backed
  Twitch connection. Mock mode is explicit and credential-free; it cannot be
  selected as a fallback from Twitch. Responses use strict DTOs and
  `Cache-Control: no-store`; production registers no mutation routes.
- Battle events pass through the existing recipient-specific EventHub
  projection and strict dashboard/overlay envelopes. Dashboard receives the
  full battle contract; OBS receives only renderable battle fields and no
  Generic tuning/processing profile configuration or owner controls. Sentinel
  tests inspect serialized event frames; no raw chat is newly exposed or
  logged.
