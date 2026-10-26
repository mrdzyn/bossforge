# P3 — Twitch EventSub Integration: Offline Readiness and Live Activation Gates

**Project:** BossForge Live  
**Base:** `main@7aa90c96133bfbc44f1809f5e89bb5c75fb892ce` (P2 squash-merge of PR #3)  
**Working branch:** `feat/phase3-twitch-readiness`  
**Current authorization:** P3-A offline integration readiness, with synthetic fixtures only. **No real OAuth, token creation, app registration, EventSub subscriptions, credential acquisition, public network binding, or live integration is authorized/possible until the developer-registration blocker is resolved and the owner explicitly approves P3-B.**  
**External blocker:** Twitch account two-factor authentication/mobile verification prevents registering an application. No authorization bypass or impersonation.

## Critical product-integrity boundary

The current implementation is expressly **mock only**:
- `ForgeSession.handleEvent` accepts only `provider === "mock"`.
- `ForgeStateSchema` requires `simulated: true` and `connectedToTwitch: false`.
- `ForgeStateEventSchema` requires `source: "mock"`.
- The dashboard and OBS explicitly say `SIMULATED / NOT CONNECTED TO TWITCH`.
- The app exposes developer-only loopback forge/simulation routes.

**Never change those guarantees as an accidental side-effect of offline readiness.** Offline fixtures are testing inputs and cannot be labeled genuine Twitch. Do not claim chat-driven live voting, bypass the current source checks by setting provider to mock, or silently flip mock/live labels. A separate, explicit, versioned P3-B migration of state, event and authorization contracts is required before real Twitch ingestion; maintain backward compatibility/validation in the transition.

## Design choice: server-side EventSub WebSocket for local streamer MVP

Use the official `channel.chat.message` EventSub subscription (currently v1), with an outgoing **server-side** connection to `wss://eventsub.wss.twitch.tv/ws`. This fits a local streamer-hosted application without a public HTTPS listener.

Official documentation (review again before P3-B):
- Registration and 2FA: https://dev.twitch.tv/docs/authentication/register-app
- Chat subscription type/required scopes: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage
- Chat EventSub auth/transport: https://dev.twitch.tv/docs/chat/authenticating
- WebSocket lifecycle: https://dev.twitch.tv/docs/eventsub/handling-websocket-events
- OAuth authorization-code flow: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth
- EventSub subscription management: https://dev.twitch.tv/docs/eventsub/manage-subscriptions/

Use a **user access token** for WebSocket transport (never an app access token). Proposed minimal read-only scope: `user:read:chat` for the authenticated chat-reading user. Recheck Twitch's precise scope/authorization rules for the chosen broadcaster/user pair at activation; do not request posting/moderation scopes or `user:bot`/`channel:bot` unless the actual selected token/transport flow requires them. No outbound chat posting is part of P3.

For real activation, prefer a server-side authorization-code flow with `state`, exact registered loopback redirect URI, server-side confidential-client token exchange and safe token refresh/revocation handling. Client ID/secret cannot be embedded in the browser. Register an app type and redirect URI consistent with Twitch's current policy; confirm details only after 2FA is unblocked. Do not collect real secrets in chat or PRs.

## System architecture

```text
P3-A (offline test-only)                         P3-B (requires separate owner activation)
Synthetic official-shaped EventSub fixtures       Twitch OAuth / user access token (server only)
        │                                              │
        ▼                                              ▼
 Zod raw event validation                       Outgoing EventSub WebSocket
        │                                     welcome / notifications / keepalive /
        ▼                                     reconnect / revocation / close
 Pure chat event normalizer                              │
        │                                       verified transport state
        ▼                                              ▼
 NormalizedChatEvent(provider: twitch)       Pure chat event normalizer (same contract)
        │                                              │
        └───────── **P3-B only**, explicit mode gate ───┘
                                  │
                     authenticated provider routing
                                  │
                   server-authoritative ForgeSession
                                  │
                 versioned, accurate forge.state and HUD
                                  │
                       dashboard / OBS / arena
```

Do not introduce any unauthenticated public control route. The existing development simulation remains loopback-only, rate-limited, mock-only and unavailable in production. The existing browser `/events` subscription remains restricted until a separately designed authenticated production transport is approved.

## P3-A — Authorized offline implementation slice (no Twitch credentials required)

1. Add a narrow server-side Twitch **EventSub chat message normalizer** and Zod schemas, referencing official `channel.chat.message` v1 fixture fields. Validate `subscription.type/version/condition`, event `broadcaster_user_id`, `chatter_user_id`, `chatter_user_name`/`chatter_user_login`, `message_id`, `message.text`, and metadata. Normalize message timestamps (official EventSub timestamps can have nanosecond precision) to a compatible ISO 8601 representation; never use local reception time as if it were Twitch event time unless explicitly modeled.
2. Map to shared `NormalizedChatEvent` with `provider: "twitch"`; use stable `chatter_user_id` for voting identity, not display name. Construct message ID from trusted source fields; prevent replay of event message IDs at the authorized intake boundary. Treat malformed, oversized, out-of-order, duplicate and wrong-channel events as rejected. Preserve existing limits or explicitly document safe bounds. Do not use a regex/HTML evaluation on untrusted message text.
3. Implement a **pure, dependency-injected EventSub session state machine/test harness** for `session_welcome`, `session_keepalive`, `notification`, `session_reconnect`, `revocation`, disconnect, ping/pong and resubscribe planning. Twitch WebSockets are inbound event transport; do not send arbitrary JSON to the socket. On true disconnect, subsequent sessions require fresh subscriptions; on server-initiated reconnect, honor the supplied reconnect URL unchanged and preserve old connection until the new welcome. Respect server-provided keepalive timeout and bounded retry/backoff.
4. Keep all fixture-to-event tests **offline and isolated**. If an adapter interface changes, preserve `MockChatAdapter` runtime and its current test path. No synthetic `provider: "twitch"` events may flow to the live `ForgeSession` or browser. The offline pipeline must not introduce production routes, connect to `wss://eventsub.wss.twitch.tv/ws`, request OAuth credentials, or call Twitch APIs.
5. Prepare a **separate design-only P3-B contract migration** for `ForgeState`, `ForgeStateEvent`, `EventHub`, `ForgeSession`, `useLiveEvents`, React dashboard and OBS so authenticated Twitch-derived votes become possible later without lying about `simulated/connectedToTwitch`. Prefer explicit tagged modes (`mock`, `twitch`) and deterministic state transitions; do not implement this migration yet.
6. Add a kill switch design: no enablement by default; no connection without positive local operator action + valid credentials + broadcaster verification, and no mixed mock/Twitch votes in the same forge cycle. Twitch disconnect/revocation must visibly move to disconnected mode and stop new live votes; reconcile currently active vote state safely instead of silently substituting mock traffic.
7. Document actual local validation and negative tests; do not fabricate a live Twitch demonstration.

## P3-B — Future live activation, NOT AUTHORIZED until registration/2FA is fixed

**Requires both owner confirmation that Twitch app credentials are available and separate explicit authorization of this implementation slice.** Never store secrets in repository, console/browser logs, screenshots, PR comments, telemetry or command-line history.

Acceptance milestones after unblock:
- OAuth browser redirect state mismatch, expired code, denied consent and exact redirect URI negative tests; access/refresh tokens stored securely **server-side** (for a local MVP, short-lived process memory only is acceptable with documented logout-on-restart) and refreshed/revoked safely. Validate tokens via Twitch's supported endpoint where applicable.
- Subscribe to `channel.chat.message` v1 for an explicitly authorized broadcaster/user pair using a **user access token** and actual WebSocket welcome `session_id`. Keep one connection by default.
- Validate sender/user/broadcaster/source, apply bounds and deduplication, and feed normalized actual Twitch events into an authorized server forge path that is distinct from local development simulation. Scope access so an authenticated streamer controls which channel may create/close a forge cycle. Avoid client-supplied provider spoofing.
- Test keepalives, dropped connection/resubscription, server-directed reconnect URL, revocation, scope/token expiration, idempotency and no event replay guarantee during disconnect.
- Version contracts and update dashboard/OBS labels only **after successful verified live connection**. Connection state must never equal `connectedToTwitch=true` merely because a local WebSocket client is connected. Keep mock mode explicitly labeled and available for local demo.
- End-to-end real broadcaster chat command creates four vote results, a revealed boss, and playable battle; test with a real Twitch channel and viewer accounts. **Do not label fixture tests as live**.
- Security review for browser subscription authorization, least-privilege scopes, token refresh and storage, OIDC/OAuth state, CSRF, XSS, logging, event/connection denial-of-service, rate limits, 3rd-party outages and data minimization. Public cloud hosting remains a separate approval.
- Only after verified real tests may a Devpost demo claim live Twitch integration.

## P3-A security and test gates

- Keep 62 existing Phase 2 tests passing; add targeted tests for malformed/wrong-channel/bounds, duplicate IDs, names-vs-IDs, text parsing, EventSub nanosecond timestamps, welcome/keepalive/reconnect/resubscribe/revocation, unknown message types and fail-closed defaults.
- Add negative tests proving real Twitch transport is NOT invoked without opt-in/registration; fixture packets cannot mutate the mock-only forge; production/dev browser endpoints remain unchanged; `provider: "twitch"` cannot be submitted via developer simulation POST. Ensure existing C5 restart and P2 combat tests remain green.
- Required checks: frozen pnpm install, build, typecheck, lint, format check, full test suite, `git diff --check`; inspect lockfile; mock full four-stage simulation; Chromium dashboard/OBS/arena regression only if runtime surfaces changed. No credentials or real Twitch network traffic in P3-A.
- Record commands, test counts, changed files and evidence in `docs/ACCEPTANCE.md`, `docs/STATUS.md`, `docs/HANDOFFS.md`, and update architecture/security as relevant.
- Commit/push to the existing P3 readiness branch and Draft PR, request independent **exact-head** review. No merge, deploy, publish, live auth/subscription, or P3-B work without owner approval.

## Decision gates / known constraints

- **Go/no-go for P3-A:** offline fixture and lifecycle tests PASS and no regressions, credential usage, or real network connections.
- **Go/no-go for P3-B:** Twitch developer console registration/2FA functional; explicit owner approval; validated least-privilege OAuth and app config; independent security assessment of the implementation.
- **2026 hackathon risk:** As long as real Twitch integration is blocked, the submitted demo must be explicitly identified as local simulation, and the entry may not satisfy Twitch integration requirements. Preserve the full working local demo rather than making risky shortcuts.
- No payments, multiplayer combat, database, public webhook listener, hosted production service or Phase 4 included in this slice.
