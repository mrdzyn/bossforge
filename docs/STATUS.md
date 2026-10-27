# Project status

## Current snapshot — 2026-10-28

- **Active milestone:** Phase 4-A — streamer voting UX and OBS readiness, developed on `feat/p4a-streamer-voting-ux` from `main` at `76a5ddeeea0986aae2ed073deaeb1a5b02fb6280`.
- **P3-B / PR #5:** Completed and squash-merged to `main` at `76a5dde`. Historical C5-R2 live acceptance remains owner-supplied, not independently reproduced. OAuth/EventSub, stable connection, four-stage forge and Phaser victory were reported PASS; 3 genuine ballots were accepted and 3 rejected. Special used its no-vote default, so success in all four categories is not claimed. Actual OBS application capture remains **UNVERIFIED**.
- **Automated P3-B evidence:** 124 tests and workspace gates passed at implementation commit `279ff63fc803921310226d9c6903a029af7f0bd5`; those fake-network results are separate from the owner-supplied live run.
- **Phase 4-A scope:** Exact canonical chat syntax and valid choices for the current stage, a visible countdown, current vote totals and a tie-aware leader, explicit default/community attribution, and separate live/simulated/disconnected labels. Live prompts require both a verified Twitch-connected forge snapshot and a connected local event feed with fresh authoritative state. Local feed loss suppresses stale vote details and reports the live vote status as unknown. The OBS overlay remains read-only. This work does not start OAuth, the authenticated runtime, or Phase 5 submissions.
- **Phase 4-A validation:** Initial implementation and P4A-C1 evidence remain in [acceptance](ACCEPTANCE.md#phase-4-a--streamer-voting-ux-and-obs-readiness). P4A-C2 addresses the reported 390px dashboard/overlay clipping using mobile-only minimum-width and wrapping constraints. Exact viewport browser checks, disconnect warning bounds, and current screenshots are in the [P4A-C2 evidence](ACCEPTANCE.md#p4a-c2--mobile-clipping-remediation). Node 24.21.0 / pnpm 11.25.0; frozen install, build, typecheck, lint, format, 19 targeted web tests, 149 full tests, four-category mock simulation and `git diff --check` passed.
- **OBS status:** Owner-supplied evidence reports visible Browser Source rendering at 1920×1080. The 1280×720 source appeared about 640×360 within a larger canvas; full-frame acceptance remains pending the owner’s Properties and **Transform → Fit to Screen** retest. Actual OBS acceptance is **PARTIAL**, not complete. See the [owner OBS checklist](P4A-STREAMER-OBS-READINESS.md#owner-obs-browser-source-checklist).
- **Prior checkpoint notes:** Sections below preserve the status and review gates that applied at those historical checkpoints. References there to an open or unmerged PR #5 do not describe the current repository state.

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
  `weakness`, with choices listed in `packages/shared/src/index.ts`. A future
  UX improvement should show this syntax and the currently valid choices in
  the overlay. Actual OBS application capture remains **UNVERIFIED**.
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
