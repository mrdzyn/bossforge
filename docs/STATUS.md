# Project status

## Current snapshot — 2026-10-29

- **Current `main` baseline for M2-C:** `6fb37e827b7466559970f714ef5f05c04af27157`; M2-B PR #12 was squash-merged after M2-A PR #11. Earlier M0/P3-B/P4A acceptance records below remain historical evidence.
- **M1-B merged:** PR #10 includes the Generic dashboard/read-only OBS presentation, freshness protection and reveal visibility remediation. PR #10 is no longer Draft or pending review.
- **M1-A merged:** PR #9 was squash-merged into `main` at `bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`. Its historical remediation and review evidence remain in [ACCEPTANCE](ACCEPTANCE.md).
- **Historical delivery note:** Initial PR creation in the first cloud workspace was blocked by an invalid GitHub CLI token. Connected GitHub access later created Draft PR #9, which is now merged; the former blocker is historical only.
- **Historical M1-A audited-head validation:** 151 tests (26 shared / 19 web / 106 server), frozen install, build, typecheck, lint, format, simulation, and browser screenshots are recorded in [ACCEPTANCE](ACCEPTANCE.md). These are historical implementation-agent reports, distinct from the later M1-A remediation and hosted GitHub Actions.
- **Historical live/OBS evidence:** Genuine Twitch activity and native OBS evidence remain owner-supplied at their original checkpoints. Chromium captures are separate browser evidence and do not establish live Twitch or native OBS acceptance. See the historical P3-B and P4A sections and [acceptance](ACCEPTANCE.md).
- **M1-B:** Original Generic dashboard/OBS implementation commit is `1cec6be2bf1bdfe75baaa5d7734ca351fa11e452`; the MINOR-2 reveal-visibility remediation commit is `c4e20c5a571ec188232fa2379d580d067dedb87d`. Connected GitHub access created the existing Draft PR [#10](https://github.com/mrdzyn/bossforge/pull/10). Its pre-remediation reviewed HEAD was `4e2ee256ccb09347e143f76242dc9a106c5b8c1d`; the final exact review HEAD is the pushed branch tip identified in the final review request. The earlier invalid GitHub CLI token incident is historical evidence only. This work is presentation-only and does not start M2.

### M2-A — server-authoritative battle engine (merged)

- M2-A was squash-merged through PR #11 into `main` at
  `15a917e229813df6d6ee344aed766c606ec17749`. Its strict Generic v1 and
  `CommunityBattleStateV1` contracts, `BossBattleSession`, reveal-to-ready
  binding, owner Start/Cancel routes, authoritative HP/deadline and terminal
  state, privacy-safe projections, `BattleStateReconciler`, and owner controls
  are the base for M2-B. The final M2-A audit/remediation evidence is historical
  and remains documented in ACCEPTANCE and HANDOFFS.
- Historical M2-A validation: Node v24.21.0 / pnpm 11.25.0; frozen install,
  build, typecheck, lint, format check, 196 tests, synthetic simulation and diff
  check passed. Socket/IPC checks required the authorized local environment
  after sandbox `EPERM`. Hosted CI was not represented as passing. These
  automated results do not establish live Twitch or native OBS acceptance.

### M2-B — secure Twitch chat combat (merged)

- **Base:** `main` at `15a917e229813df6d6ee344aed766c606ec17749`, containing the
  M2-A PR #11 squash merge.
- **Merge:** Draft PR #12 was squash-merged into `main` at
  `6fb37e827b7466559970f714ef5f05c04af27157`; the earlier Draft status below is
  historical. M2-B remains synthetic-only evidence, not live Twitch acceptance.
- **Scope:** `feat/m2b-twitch-chat-attacks` adds the strict `!hit` grammar,
  private server attack router, bounded ingress/replay/cooldown/rate controls,
  source/provider/encounter checks, server-session damage transitions,
  dashboard-only fixed rejection aggregates, and accurate active-encounter
  command/status presentation. The read-only OBS projection receives no
  diagnostics or controls. No browser damage endpoint exists.
- **Synthetic evidence:** deterministic tests cover parser inputs, mock routed
  damage, base/weakness/mismatch outcomes, replay, cooldown, provider generation,
  Twitch verification gating, exact deadline behavior, terminal victory and
  private aggregate projection. The server integration test completes four
  no-vote fallback stages, starts the authoritative encounter, routes eight
  synthetic `!hit water` events through `/dev/simulation/events`, and reaches
  victory at zero HP. This is synthetic local evidence, not a real Twitch test.
- **Audit remediation:** At GPT-6 audited HEAD
  `c0df65b1022999a52ba1ac1391a75e712bf8f30d`, MAJOR-1 and MINOR-1/MINOR-2 are
  fixed. Deadline expiry closes intake and coordinates router queue draining
  before `expired`; accepted tokens debit only after a successful session
  transition; late classification uses monotonic battle-deadline eligibility.
  Real router/session fake-scheduler tests cover both deadline/drain orderings,
  lethal and surviving queued hits, exact/after-boundary `late` reasons, and
  rejected-transition token preservation.
- **Validation:** Node `v24.21.0` / pnpm `11.25.0`; frozen install, build,
  typecheck, lint, Prettier, all 222 tests (39 shared / 146 server / 37 web),
  89 focused battle/security tests, four-category synthetic simulation and
  `git diff --check` passed. Socket
  binding required the authorized local rerun after sandbox `EPERM`. The build
  retains the optional Phaser large-chunk advisory; hosted CI is not claimed.
- **Implementation commit:** `304ed6f777d4069e710b05e2aefff615dc7fc266`.
- **Delivery:** Draft PR [#12](https://github.com/mrdzyn/bossforge/pull/12)
  targets `main` at the exact base above. It remains open, Draft and unmerged;
  independent exact-head review is requested.
- **Not claimed:** no real Twitch API/EventSub or owner credentials were used;
  live `!hit` acceptance, native OBS battle presentation, chat-driven HP over a
  real stream, M2-C polished overlay/animations, challenges and Arena profile
  remain unverified or deferred. Hosted GitHub Actions is not claimed as
  passing.

### M2-C — OBS battle HUD and full integration (implementation)

- **Base:** `main` at `6fb37e827b7466559970f714ef5f05c04af27157`, including the
  M2-B PR #12 squash merge. The working branch is `feat/m2c-obs-battle-hud`.
- The OBS overlay now consumes strict `OverlayBattleStateV1` events on its
  existing single `/events/overlay` connection and bootstraps from the
  development-only, loopback-protected, no-store `/battle/overlay-state`
  projection. Battle epochs/revisions/encounters and full forge identity must
  reconcile on the current socket generation. Missing authority hides combat
  values and prompts.
- **Implementation and synthetic Chromium QA are complete on this branch.**
  The read-only HUD consumes strict overlay projections and requires fresh,
  generation-bound HTTP/WS authority. At 1920×1080, 1280×720, 1600×900 and
  390×844, the key battle panel stayed inside the viewport with no horizontal
  overflow; loss/restart hid stale combat data and recovered only after a new
  epoch snapshot. Synthetic mock tests cover ready, active, hit, victory,
  expired and cancellation states. See `docs/visual-qa/m2c/` and M2-C acceptance.
- **Not verified:** genuine Twitch traffic, native OBS rendering, hosted CI,
  and release behavior. Chromium captures are not native OBS evidence.
- **Validation:** Node `v24.21.0`, pnpm `11.25.0`; frozen install, build,
  typecheck, lint, format check, full suite (233 tests: 41 shared, 147 server,
  45 web), `pnpm simulate`, and `git diff --check` passed. A sandbox run first
  hit `EPERM` on loopback socket tests; the authorized local rerun passed.
  These are manual/local CI-equivalent results; hosted GitHub Actions are not
  claimed as passing. The existing optional Phaser chunk-size advisory remains.

### M1-A merged status

- PR #9 squash-merged at `bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`.
  Historical GitHub CLI `Forbidden` evidence is retained in ACCEPTANCE; PR
  creation is no longer blocked.
- Aggregate activity generation/freshness remediation and its tests are part
  of the merged main baseline. See the M1-A C1 acceptance entry.

### M1-B — Generic OBS and dashboard states

- Authorized presentation-only work is on `feat/m1b-generic-obs-states`, based
  on the merged main SHA above. The dashboard and read-only overlay distinguish
  idle, voting, revealed, disconnected, and unavailable states using fresh
  privacy-safe authoritative projections.
- No battle state, HP, damage, timers, Start Battle, `!hit`, profile loading, or
  game integration is included. M1-B validation, screenshots and exact review
  target are recorded in the M1-B sections of ACCEPTANCE and HANDOFFS.
- MINOR-2 places the exact `REVEALED — BATTLE COMING SOON` status beside the
  visible boss heading. The recorded 1440×900 first-viewport Chromium QA shows
  the message fully visible; see [M1-B acceptance](ACCEPTANCE.md#post-remediation-first-viewport-qa).

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

## M1-A privacy-safe outbound events — historical implementation checkpoint

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
  review was pending at this checkpoint; M1-A was subsequently accepted and squash-merged through PR #9.
- Implementation is pushed to origin as commit
  `7eb556f5c17af426d155470ae11ff07afa3d6a0f`; Draft PR #9 was subsequently
  created through connected GitHub access. The original GitHub CLI `Forbidden`
  failure is retained as a historical environment issue and is not a current
  PR-creation blocker.
