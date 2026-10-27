# Phase 3-B — Authenticated Local Twitch Chat + EventSub Voting

**Status:** B1–B3 implementation candidate on Draft PR #5. Owner-controlled local QA observed successful OAuth, verified EventSub, and forge start; a later EventSub loss canceled voting after Body and Element opened. Reconnect restored connection only. Genuine notification delivery and vote counting remain **NOT VERIFIED**. See [C5 acceptance evidence](ACCEPTANCE.md#p3-b4-c5--eventsub-disconnect-investigation).
**Base:** `main@5adbd71f5378666e17b805617f37c3bb000505b8` (P3-A independently audited and squash-merged via PR #4)  
**Working branch:** `feat/phase3b-live-twitch-integration`  
**Delivery:** One Draft PR, bounded implementation checkpoints, independent exact-head review, **separate explicit owner squash-merge decision**.  
**Product goal:** Real Twitch viewer `!vote` commands shape the same playable BossForge boss, with independently identifiable **SIMULATED** and **LIVE TWITCH** sessions. No deployment, publishing, public server, or chat posting.

## Owner-provisioned Twitch application and local developer setup

The owner has registered a Twitch app and approved **P3-B**, including real local OAuth and EventSub, but **not** commit/merge/release/deploy actions. The Client ID was provided privately in chat. Never check it into tracked configuration, and never request/paste a Client Secret or OAuth tokens into ChatGPT, GitHub, PRs, screenshots, test fixtures or logs. The Client ID is not a password, but keep configuration environment-driven to support other operators.

**Registered/intended callback:** `http://localhost:3001/auth/twitch/callback`. Verify it is **literally registered** in the Twitch Developer Console and that the loopback Fastify listener accepts it before using real OAuth. If port 3001 is occupied, **do not kill unknown processes** or silently switch ports; the app must report a clear configuration mismatch and the owner must adjust the registered callback if a different port is needed. Preserve strict loopback-only listening and safe Host validation, including IPv4/IPv6 localhost resolution.

Local secret provisioning (example placeholders only, never real values in repo):

```text
TWITCH_CLIENT_ID=<configure locally>
TWITCH_CLIENT_SECRET=<configure locally in gitignored env/secret store>
TWITCH_REDIRECT_URI=http://localhost:3001/auth/twitch/callback
TWITCH_INTEGRATION_ENABLED=false   # default fail-closed; explicit opt-in to enable
```

Do not make Twitch access a prerequisite for `pnpm simulate` or for an ordinary fresh checkout. Use `.env.example` with empty placeholders only; ensure `.env` and all credential files remain ignored. Do not emit environment dumps, token objects, authorization codes or secret-bearing URLs to stdout/CI.

## Verified Twitch protocol requirements

Official docs (confirm before coding/activation):

- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth — server-side authorization-code grant, `state`, exact registered `redirect_uri`, confidential client secret server only, code exchange.
- https://dev.twitch.tv/docs/authentication/refresh-tokens — safely refresh user access token and rotate refresh token on success.
- https://dev.twitch.tv/docs/authentication/validate-tokens — validate third-party OAuth sessions on startup and **at least hourly**, including correct `client_id`, `user_id`, and `scopes`.
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events — outgoing server-side `wss://eventsub.wss.twitch.tv/ws`, welcome ID, create REST subscription promptly (normally within **10s**); validated keepalive; browser/WebSocket Ping does _not_ reset EventSub timer; preserve supplied reconnect URL on handoff; unexpected disconnect requires resubscription, no replay guarantee.
- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage — `channel.chat.message` v1; WebSocket **user access token** with `user:read:chat` initial scope; condition has `broadcaster_user_id` and chat-reader `user_id`.
- https://dev.twitch.tv/docs/eventsub/manage-subscriptions/ — create via Helix REST, transport `method: websocket`, current `session_id`.

Local MVP: authenticate the **broadcaster's own Twitch account** with `user:read:chat`, then set _both_ condition identities to the validated account's numeric user ID for the broadcaster's own channel. Do not assume a separate bot account has identical permissions; support another reader/broadcaster pairing only after explicit authorization and tests. Do not request `user:write:chat`, moderation or posting privileges for read-only voting. Use a user access token, **not an app access token**, for a WebSocket subscription.

## Architectural sequencing and strict boundaries

1. **P3-B1: OAuth local backend and preflight.** Isolate token handling from React, OBS, EventHub, normal browser events, logs and app commits. Explicit opt-in; all routes localhost/socket-peer plus Host checked, with CSRF and OAuth state protection.
2. **P3-B2: real EventSub adapter.** Wrap the P3-A normalizer + lifecycle harness with production transport and Helix subscription management, replay checks and timeouts. Require a successful real welcome + verified subscription before reporting live chat connected. Fix P3-A non-blocking double-reconnect pending-socket guard **before attaching a real transport**; do not allow orphaned sockets or dual subscriptions.
3. **P3-B3: provider-authenticated forge and contracts.** Evolve `ForgeSession` and shared state/events with an explicit `mode: mock | twitch` (or equivalent tagged source), version migration and honest network connection status. No relabeling real Twitch events as mock. Exactly one mode per forge cycle; real mode only accepts validated authorized EventSub messages, mock mode only mock events. Preserve deterministic ballots keyed by viewer's numeric `chatter_user_id`. Maintain the C5 server-instance/revision reconciliation and P2 arena identity invalidation across disconnect/mode changes.
4. **P3-B4: secure streamer UI, live end-to-end acceptance and independent audit.** Streamer sees local `Connect Twitch`, authenticated channel identity, status, disconnect and forge controls; OBS has no auth controls, tokens or login URLs. Labels read **SIMULATED / NOT CONNECTED TO TWITCH** in mock/unverified mode and only **TWITCH CONNECTED** after verified real EventSub subscription. Show accurate disconnected/reconnecting/revoked states; do not silently switch to mock.

**Global invariant:** Phase 0 loopback-only Vite/Fastify, strict effective host checks, local socket-peer controls, Origin/Fetch Metadata policy, rate limits, 8KB dev mutation/frame caps and production lack of unauthenticated APIs must not regress. Do not open 0.0.0.0, trust `X-Forwarded-For`, enable public /events, or expose Twitch secrets.

## P3-B1: precise OAuth behavior

- Add a development-only local operator opt-in configuration and a **local-only OAuth start and callback** route. Callback must match `TWITCH_REDIRECT_URI` literally and point at Fastify, not Vite. Treat OAuth callback as a cross-site top-level browser navigation; do not apply the unrelated same-origin POST mutation header policy to this safe GET callback.
- Secure `state` with 128+ bits of randomness, short-lived single-use server-side storage and browser-bound `HttpOnly`, `SameSite=Lax` cookie or equivalent CSRF-safe correlation. Check expiration/replay/state mismatch, denied consent, duplicate query params, missing code, and Host mismatch. No reflected arbitrary `next` or redirect URL. Local callback HTTP is acceptable _only_ on loopback in dev; use `Secure` cookies in HTTPS contexts. Cookies `Path`, TTL and appropriate host scope must be deliberate.
- Code exchange server-to-server `https://id.twitch.tv/oauth2/token` with secrets never exposed to frontend; validate response shape, Twitch `/oauth2/validate`, `client_id`, scope, numeric authorized user ID, and token expiry. Bind the verified local operator to that OAuth session. Clear transient state after success/failure, and ensure browser receives no tokens/refresh token/auth code in pages, URL fragments or response JSON.
- Store user access and rotating refresh tokens **in process memory only** for this local hackathon MVP. Restart ends login; no database. Validate hourly and before sensitive actions as needed; handle 401 refresh once under a single-flight lock; on revoked or failed refresh, disconnect EventSub, invalidate Twitch-mode voting safely, clear tokens and require explicit reauthorization. Implement explicit local disconnect/logout including cookie cleanup and preferably Twitch revocation best-effort; no persistence. Prevent refresh storms.
- Use bounded HTTP timeouts/redirect policy, safe error mapping without leaking Twitch responses/headers, Content-Security-Policy and `Cache-Control: no-store` for auth pages and callbacks. Verify OS localhost / IPv6 and dev Vite integration with real browser.
- For state-changing streamer controls (connect/disconnect, start/reset Twitch forge, mode switch), require verified owner authorization and same-origin/CSRF protections. A random third-party page must not activate these endpoints through CSRF even though they are bound to loopback. Never claim loopback address alone authenticates the streamer.
- Include a human-readable **not configured** state when secret/env missing; no Twitch connection attempts by default. Do not auto-open OAuth or subscribe merely because `TWITCH_CLIENT_ID` is present.

## P3-B2: verified EventSub WebSocket and subscription

- Use one outbound secure WSS connection by default, with max frame size and well-defined shutdown. Prevent pending reconnect socket leak, duplicate subscription creation and repeated double-reconnect reentrancy. Honor server-provided reconnect URL _unchanged_ after validating scheme/allowed host; keep old receiving until replacement session welcome. The normalizer and harness must reject malformed/wrong-channel/reader/subscription/version inputs.
- On genuine `session_welcome`, promptly POST `https://api.twitch.tv/helix/eventsub/subscriptions` with `type: channel.chat.message`, `version: 1`, `condition: {broadcaster_user_id, user_id}`, `transport: {method: websocket, session_id}` under the validated **user** Bearer token and matching Client-Id header. Handle 202/409/401/403/429/network timeout explicitly; determine when already-subscribed from Twitch response rather than silently assuming. No subscription REST call on server-directed reconnect since Twitch transfers it; unexpected disconnect requires new subscription.
- `TWITCH CONNECTED` requires verified session + subscription activation, not merely WSS open or OAuth success. No chat forwarding until session/subscription and operator mode gate are valid. Deduplicate chat messages by trusted `message_id`, bound memory, validate event `condition.user_id` against actual authorized chat reader, sender stable Twitch `chatter_user_id` as ballot owner, and preserve real occurredAt.
- On revocation, socket failure, token validation failure, channel mismatch or intentional logout, **stop live ballot intake immediately**, update accurate status, and apply documented fail-safe voting timer policy. Never replace failed live votes with synthetic ones without an explicit new mock cycle.
- Ensure EventSub events cannot issue commands outside the tightly parsed `!vote <category> <choice>` surface. No arbitrary code/function/agent tool execution.

## P3-B3: contract migration and UI

- Current `ForgeStateSchema` has literals `simulated:true`/`connectedToTwitch:false`, and `ForgeStateEventSchema.source` is literal `mock`; `ForgeSession.handleEvent` rejects non-mock. Migrate these intentionally with explicit provider mode and compatible versioning. Preserve meaningful **source ≠ transport connected status**; do not convert a twitch packet into a mock packet. Upgrade existing C5 reconciler and `useLiveEvents` to support an old/new schema transition without state rollback. Tests prove old mock snapshots remain understood where appropriate.
- Same four vote stages, tied ballots, deterministic fallback and boss assembly rules for both modes; configure streamer controls only with authenticated owner. In Twitch mode, no untrusted browser source spoofing; only the verified EventSub adapter can forward Twitch event messages internally.
- Separate Twitch and mock cycles; reject cross-mode message injection, stale cycle IDs, wrong broadcasters and duplicate/replayed messages. On disconnect, choose **pause/cancel live voting with explicit user feedback**, not silently auto-conclude a fabricated Twitch result. Define resumed-cycle behavior and tests.
- Display safe read-only Twitch connection status in dashboard and OBS without user tokens, OAuth codes, secrets or administrative controls on OBS. Keep explicit mock disclosure; connect controls local and auth-gated. Preserve arena replay/invalidity behavior.

## Acceptance and verification

**Automated checks:** frozen install; build; typecheck; lint; format; full tests (baseline **92**); `git diff --check`; mock simulation; targeted OAuth/CSRF/Host/redirect/cookie tests; token refresh/validate/revocation tests; EventSub accepted/welcome/reconnect/double-reconnect/retry/duplicate/wrong identity tests; 401/403/429 handling; live-vs-mock isolation; public-bind guard; no secrets in source or logs.

**No-credential CI:** injectable fake OAuth HTTP client, fake WSS/Helix, fake clock and deterministic fixtures; no test must hit the real Twitch API or require the owner's secret. Do not place tokens in test output.

**Manual local owner QA:** Owner-controlled QA has observed OAuth, verified subscription, forge start, and a disconnect cancellation. The genuine EventSub notification and counted chat-vote stages remain **NOT VERIFIED**. Continue only with the controlled, redacted procedure below; owner must participate in OAuth and real chat posting.

**Browser QA:** Chromium 1440×900 dashboard, 390×844 no overflow, OBS 1920×1080 + 1280×720, arena combat, disconnect/reconnect states. Capture screenshots only with identifiers and sensitive data redacted or absent, and report actual errors/limitations.

**Deliverables:** update `docs/STATUS.md`, `docs/ACCEPTANCE.md`, `docs/HANDOFFS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`, README, env placeholders and new focused runbook. Commit and push to **existing P3-B branch/Draft PR**, no new PR. Request independent exact-head audit for each security-relevant slice.

**Human approvals:** Approved: begin P3-B development and local authenticated Twitch integration. Not approved: squash/merge, cloud/public deployment, release, publishing, production remote access, secret disclosure or Phase 4. Do not treat code-writing approval as permission to run OAuth against an account without local operator consent. Owner must explicitly start/login through the app.

## Known future hardening

- **Resolved in this P3-B implementation:** guard multiple distinct `session_reconnect` messages by closing the prior pending transport before opening its replacement; a regression test covers this.
- Strict per-process monotonic EventSub timestamp rejection might discard legitimate cross-socket out-of-order delivery; review event ordering vs replay guarantees when real traffic becomes available.
- Existing C5 process epoch ordering by wall clock is local-development acceptable but not a cross-machine distributed guarantee.

## P3-B4-C5 — EventSub disconnect investigation

### Observed live evidence

Owner-controlled local testing observed OAuth completion, a verified EventSub
subscription, a successful authenticated forge start, Body and Element voting,
and an advancing timer. EventSub then disconnected; the authoritative forge
canceled to idle. Reconnection restored Twitch connection state but did not
resume the canceled cycle. No genuine chat notification or counted vote is
verified. This is partial operational evidence, not end-to-end acceptance.

The live run did not retain a numeric WebSocket close code or socket error
classification. The exact trigger therefore remains unknown. Source inspection
shows an internal watchdog scheduled at exactly
`keepalive_timeout_seconds * 1000`; Twitch's [WebSocket guidance](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)
says to infer a lost connection when silence lasts **longer than** the timeout.
The equality boundary may race an arriving keepalive, but is still only a
hypothesis and was not patched without live diagnostic evidence.

### Opt-in diagnostic safeguards

`BOSSFORGE_EVENTSUB_DIAGNOSTICS=true` enables only volatile, bounded counters
in development mode. The `/dev/twitch/diagnostics` route is absent by default
and requires a loopback request, allowed same-origin browser Origin, and the
authenticated Twitch owner session. It is not exposed to OBS. Values are fixed
reason codes, numeric WebSocket close codes, allowlisted socket-error classes,
relative elapsed/timeout milliseconds, subscription/reconnect states, and
normalization/chat-callback/ballot counters. Raw frames, message text, IDs,
usernames, URLs, credentials, and full error objects are never stored or
returned.

The diagnostics were exercised only with fake sockets and synthetic fixtures.
They were not enabled in the authenticated runtime; enabling the flag requires
a separately coordinated server restart and owner reauthorization because
OAuth state is process-memory only. Do not automatically resume a canceled
forge or synthesize missing ballots.

### Next controlled live check

After the owner separately coordinates a safe local restart and reauthorization,
open the dashboard at `http://localhost:5173` and confirm the actual EventSub
subscription is enabled. In the Twitch controls, click **Read local EventSub
diagnostics**; this sends an authenticated same-origin POST and renders only the
sanitized snapshot in the dashboard. Do not open the diagnostics path in the
address bar. Start a forge with **60 seconds per category**, send one genuine
`!vote body drake` during Body from the intended viewer, and confirm
notification, normalization, callback, accepted ballot, Body total, and
dashboard count. Record only fixed counters and relative timings. Continue
observing status counters; if a disconnect occurs, do not resume the cycle or
claim a pass. Reconnect must again require a fresh verified subscription. No
fake event is live evidence.
