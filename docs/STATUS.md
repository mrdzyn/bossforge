# Project status

## Current snapshot — 2026-10-28

- **Current `main`:** `d556ef124fb9c98ae6c0801c68c76e38ec83a18b`; M0 was squash-merged through PR #8. The M0 contract and prior P3-B/P4A acceptance records below remain historical evidence.
- **M1-A / Draft PR #9:** PR #9 exists against `main` on `feat/m1a-privacy-safe-events`. The audited baseline was `ec25b4a9bc2603f7a1fb0da2d960026fe38daf46`; source implementation commit is `7eb556f5c17af426d155470ae11ff07afa3d6a0f`. The bounded MAJOR-1 aggregate-freshness and MINOR-1 status reconciliation changes are implemented and validated locally; exact pushed remediation HEAD is recorded in the latest M1-A entry in [ACCEPTANCE](ACCEPTANCE.md). The new audit has not approved M1-A; keep PR #9 Draft/unmerged and do not begin M1-B/M2.
- **Historical delivery note:** Initial PR creation in the first cloud workspace was blocked by an invalid GitHub CLI token. Connected GitHub access subsequently created Draft PR #9; the former blocker is resolved. Retain the original failure as history, not as current PR status.
- **Validation at audited HEAD:** 151 tests (26 shared / 19 web / 106 server), frozen install, build, typecheck, lint, format, simulation, and browser screenshots were reported by the implementation agent and documented in [ACCEPTANCE](ACCEPTANCE.md). The independent reviewer did not rerun them. New remediation results will be recorded separately and must not be conflated with hosted GitHub Actions.
- **Historical live/OBS evidence:** Genuine Twitch activity and native OBS evidence remain owner-supplied at their original checkpoints. Chromium captures are separate browser evidence and do not establish live Twitch or native OBS acceptance. See the historical P3-B and P4A sections and [acceptance](ACCEPTANCE.md).
- **Out of scope:** No M1-B, `!hit`, battle HP/timers, Generic/Arena profile loading, live Twitch connection, deployment, or publication is authorized by this remediation.

### M1-A C1 bounded remediation status

- Dashboard aggregate activity now follows the live feed generation and fresh
  authoritative forge state. Feed loss clears displayed aggregates
  immediately; retired-generation messages are rejected; reconnect requires a
  fresh state and activity tagged to its server instance and cycle.
- Current PR status is Draft PR #9, created through connected GitHub access.
  The earlier GitHub CLI `Forbidden` event remains historical evidence only.
- Cloud/local validation and the remediation commit are recorded in
  [ACCEPTANCE](ACCEPTANCE.md). GitHub Actions remains unavailable, and the
  independent GPT-6 exact-head review is pending.

## P3-B-C2 remediation checkpoint

- Addressed all four C1 findings on the existing Draft PR #5 branch: ordered
  mode transition epochs and snapshots; transport-specific idempotent
  disconnect handling; welcomed-session leases for Helix verification; and a
  fresh mock simulation fallback after authenticated Twitch logout.
- Regression suite: 110 tests (23 shared / 87 server), preserving the 106-test
  C1 baseline and the C5 backend-restart safeguard. Full command outcomes,
  synthetic simulation, browser QA and disabled localhost auth preflight are in
  [ACCEPTANCE](ACCEPTANCE.md).
- Twitch remains disabled by default. QA used synthetic credential strings and
  fake transports; no real Twitch account or endpoint, public route or
  deployment was used. Live behavior remains **NOT TESTED**.
- Request independent exact-head P3-B-C2 review on existing Draft PR #5. Keep
  it open, Draft and unmerged; do not enable the integration.

## P3-B4-C5 EventSub disconnect investigation

- Partial live QA observed authenticated OAuth, a verified EventSub subscription,
  and a successful forge start. Body and Element stages opened and the timer
  advanced; EventSub then disconnected, canceled the active cycle, and later
  reconnected without restoring voting. No genuine chat vote was verified.
- The live run did not retain a close code or socket error class, so it cannot
  distinguish transport termination from the application keepalive watchdog.
  Source confirms the watchdog is scheduled at exactly the advertised timeout;
  Twitch guidance says to infer loss after the timeout is exceeded. This is a
  plausible boundary race, not a proven live root cause.
- Added default-off, in-memory diagnostics at a loopback-only, same-origin,
  Twitch-owner-protected development route. Counters include allowlisted
  disconnect/error categories, numeric close codes, relative keepalive timing,
  subscription/reconnect states, normalization and ballot outcomes. No raw
  frames, chat, IDs, names, URLs, credentials or error objects are retained.
  This route was not activated in the running authenticated process.
- Full isolated validation: 121 tests (23 shared / 98 server) passed after
  running socket-binding tests in the authorized local test environment. Server
  build, typecheck, lint and formatting passed. No Twitch endpoint or live vote
  was used. Details are in [ACCEPTANCE](ACCEPTANCE.md).

## P3-B4-C5-R1 — diagnostic browser compatibility

- Fixed C5-01 by making diagnostics a read-only POST query. It requires the
  development loopback server, an allowed Origin, exact
  `Sec-Fetch-Site: same-origin`, and a valid Twitch owner session; it remains
  absent by default and returns `Cache-Control: no-store`.
- The authenticated dashboard now provides an owner-visible button to issue
  this same-origin request and render the sanitized response. Address-bar GET
  is unsupported. No diagnostics were activated against Twitch and the
  authenticated runtime was not restarted.
- Added route tests for enabled/disabled behavior, authenticated and invalid
  sessions, missing Origin/Fetch Metadata, cross-site and non-loopback callers,
  no-store, response minimization, and unchanged forge state. Under Node
  v24.21.0 / pnpm 11.25.0, frozen install, build, typecheck, lint, formatting,
  all 121 tests, four-category mock simulation, and diff check passed. The
  initial sandbox test attempt hit socket-binding `EPERM`; the full suite passed
  in the authorized local environment. See [R1 acceptance](ACCEPTANCE.md#p3-b4-c5-r1--diagnostic-browser-compatibility).
- No authenticated browser session was restarted or used to query diagnostics;
  live click-through remains pending owner-coordinated QA.

## P3-B4-C5-R2 — EventSub keepalive remediation

- Preserved the owner’s sanitized live evidence: 5 validated welcomes and
  enabled Helix subscriptions, 8 keepalives, 2 accepted and normalized
  notifications, 1 genuine ballot accepted, 1 rejected as `inactive-voting`,
  4 keepalive-timeout losses, no socket closes/errors, and 1 canceled forge.
  The final loss was recorded at 10,001 ms for a 10,000 ms advertised window.
- The initial EventSub URL now requests a 30-second keepalive interval using
  Twitch’s supported `keepalive_timeout_seconds` parameter. The timeout from
  each validated welcome remains authoritative; the request does not assume
  Twitch accepted 30 seconds. Server-directed reconnect URLs are passed through
  unchanged.
- The watchdog now uses monotonic elapsed time and a 250 ms bounded grace,
  rechecks the latest validated keepalive/accepted notification at callback
  time, and remains fail-closed after the advertised timeout plus grace.
  Canceled voting is not resumed and missing ballots are not synthesized.
- Deterministic fake-clock/socket regressions cover the boundary, valid traffic
  during grace, true expiry after grace, notification timer reset, stale timer
  isolation, socket loss, revocation/logout, reconnect URL preservation, and
  duplicate protections. The authenticated runtime was not restarted and no
  Twitch endpoint or new real vote was used for this remediation; the prior
  owner-controlled ballot evidence remains recorded above.
- Independent implementation review passed at `279ff63`; the final
  documentation-only evidence update now awaits exact-head review. Keep Draft
  PR #5 unmerged.

### Owner-supplied live acceptance

- OAuth/EventSub passed: 1 valid welcome, 1 enabled Helix subscription, 11
  keepalives for the 30,000 ms advertised timeout; 6 accepted notifications,
  normalized messages and chat callbacks; 0 socket closes/errors,
  keepalive disconnects or forge cancellations.
- Three genuine ballots were accepted; three were rejected (one
  `wrong-category`, two `invalid-choice`). Four stages completed, but this
  does not mean each category received an accepted genuine vote. The Special
  result used its default.
- The boss Cinder Granite was revealed with Golem / Fire / Ember Burst
  (default) / Earth. The Phaser arena ended in VICTORY at boss HP 0/120 and
  streamer HP 64/100. Connection stability and the complete forge-to-victory
  demonstration are **PASS**, based on owner-supplied live results.
- Canonical accepted chat syntax is `!vote <category> <choice>`; category must
  be the active stage. Categories are `body`, `element`, `special`, and
  `weakness`, with choices listed in `packages/shared/src/index.ts`. At the
  P3-B checkpoint, showing this syntax in the overlay was a future UX
  improvement; P4A now supplies the active-stage commands. The P3-B live run
  did not include OBS capture; separate P4A owner-supplied OBS visual QA passes
  at both target resolutions, as recorded above.
- These runtime results were supplied by the owner and were not independently
  reproduced. Automated fake-transport validation remains separate: 124 tests
  passed at the audited implementation head.

## P3-B-C4 remediation checkpoint

- Fixed C3-01 on the existing Draft PR #5 branch: unexpected close/error of
  the active verified EventSub socket now reaches the session-loss callback
  before its adapter transport lease is cleared. This immediately drops
  verified subscription state, publishes disconnected status, and cancels a
  Twitch voting cycle.
- Fake socket coverage checks active close, error followed by close,
  current versus retired sockets, immediate server forge state, and recovery
  only after the replacement welcome and Helix subscription verification.
- The C4 full suite has 113 tests (23 shared / 90 server), preserving the
  112-test C3 baseline. Command evidence and mock simulation are in
  [ACCEPTANCE](ACCEPTANCE.md#p3-b-c4--bounded-remediation-of-c3-01).
- Twitch remains disabled by default. No credentials or real Twitch network,
  merge, deployment, publication or Phase 4 work was used. Request independent
  exact-head C4 review; keep PR #5 Draft and unmerged.

## P3-B implementation checkpoint

- **B1:** Added default-disabled confidential-client authorization-code OAuth at the exact local callback. Browser-bound single-use state, HttpOnly/SameSite cookies, exact Host/loopback checks, `user:read:chat` scope, validated numeric identity/client ID, in-memory access/rotating refresh tokens, refresh, hourly validation, revocation, logout and safe error responses are covered with deterministic fake HTTP tests.
- **B2:** Wired the P3-A normalizer/session harness to an outbound WSS transport and Helix `channel.chat.message` v1 subscription. Subscriptions use the authenticated user token and self broadcaster/reader IDs, are verified enabled before forwarding, retry/resubscribe after unexpected disconnect, and stop on revocation. The pending reconnect orphan-socket condition is fixed.
- **B3:** Shared forge state/events now carry explicit provider mode and consistency-checked simulation/connection flags. `ForgeSession` accepts only the active mode; Twitch-mode HTTP controls require the OAuth browser session and exact local Origin/Fetch Metadata; mock injection is disabled in Twitch mode. Dashboard controls and OBS labels remain credential-free and accurately distinguish mock, connected and disconnected states. P2 arena continues to consume the same authoritative boss state.
- **Codex validation:** Workspace test total is 106 (23 shared, 83 server), preserving all 92 P3-A tests. Frozen install, build, typecheck, lint, format check, full suite, `git diff --check`, synthetic simulation and local Chromium regression passed. Exact command outcomes and screenshots are in [ACCEPTANCE](ACCEPTANCE.md).
- **Not tested / owner action:** This environment has no applied Twitch secret configuration. No OAuth consent, Twitch API/WSS request, or live channel vote was attempted. Review and publish the saved environment draft, configure the registered Client ID/secret privately, confirm the exact callback in Twitch console, and personally initiate OAuth before any real integration result can be claimed. Ports 5173 and 3013 were occupied, left untouched; browser QA used loopback ports 5201/3201.
- **Delivery gate:** Existing Draft PR #5 only; no merge/deploy/release. Independent security review is pending for the exact pushed HEAD. Codex tests and browser captures are not approval.

## Acceptance target

A verified local Twitch broadcaster logs in securely; server-side EventSub receives genuine `!vote` chat commands; four timed categories assemble the same boss; the streamer fights it in Phaser; dashboard and OBS accurately distinguish real Twitch versus synthetic mode; revocation, disconnect and authorization failure fail closed. Preserve all 92 existing tests, local-only security and synthetic demo.

## Canonical documents

- [P3-B active specification](P3B-LIVE-TWITCH-INTEGRATION.md)
- [P3-A implementation background](P3-TWITCH-INTEGRATION-READINESS.md)
- [Security](SECURITY.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Acceptance evidence](ACCEPTANCE.md)
- [Handoffs](HANDOFFS.md)

## M1-A privacy-safe outbound events — implementation candidate

- Implemented on `feat/m1a-privacy-safe-events` from expected M0 main SHA
  `d556ef124fb9c98ae6c0801c68c76e38ec83a18b`. Raw normalized mock and Twitch
  chat remains server-internal; public dashboard and OBS WebSocket endpoints
  use separate strict versioned schemas and explicit projections. HTTP forge
  snapshots and mutation responses use the same allowlist projection.
- Dashboard activity contains bounded aggregate accepted/rejected counts and
  fixed reason buckets, reset at forge-cycle and provider lifecycle changes.
  The dashboard no longer renders viewer names, avatars, or chat text. OBS is
  read-only and receives no aggregate activity. Legacy `/events` is pinned to
  the dashboard DTO and cannot publish raw chat.
- Validation recorded in `docs/ACCEPTANCE.md`: frozen install, build,
  typecheck, lint, format check, 151 tests, local synthetic simulation, and
  real Chromium dashboard/overlay screenshots. No hosted CI, real Twitch
  session, or native OBS run was performed. Independent exact-head security
  review is pending; M1-A is not accepted until that audit passes.
- Implementation is pushed to origin as commit
  `7eb556f5c17af426d155470ae11ff07afa3d6a0f`; Draft PR #9 was subsequently
  created through connected GitHub access. The original GitHub CLI `Forbidden`
  failure is retained as a historical environment issue and is not a current
  PR-creation blocker.
