# Project status

## Current snapshot — 2026-10-30

- **Current `main` baseline:** `fc95b1366deea38ceb67ee4c11db2883a053a272`; PR #17 owner evidence and PR #19 keepalive remediation are merged. Earlier M0/P3-B/P4A acceptance records below remain historical evidence.
- **M1-B merged:** PR #10 includes the Generic dashboard/read-only OBS presentation, freshness protection and reveal visibility remediation. PR #10 is no longer Draft or pending review.
- **M1-A merged:** PR #9 was squash-merged into `main` at `bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`. Its historical remediation and review evidence remain in [ACCEPTANCE](ACCEPTANCE.md).
- **Historical delivery note:** Initial PR creation in the first cloud workspace was blocked by an invalid GitHub CLI token. Connected GitHub access later created Draft PR #9, which is now merged; the former blocker is historical only.
- **Historical M1-A audited-head validation:** 151 tests (26 shared / 19 web / 106 server), frozen install, build, typecheck, lint, format, simulation, and browser screenshots are recorded in [ACCEPTANCE](ACCEPTANCE.md). These are historical implementation-agent reports, distinct from the later M1-A remediation and hosted GitHub Actions.
- **Historical live/OBS evidence:** Genuine Twitch activity and native OBS evidence remain owner-supplied at their original checkpoints. Chromium captures are separate browser evidence and do not establish live Twitch or native OBS acceptance. See the historical P3-B and P4A sections and [acceptance](ACCEPTANCE.md).
- **M1-B:** Original Generic dashboard/OBS implementation commit is `1cec6be2bf1bdfe75baaa5d7734ca351fa11e452`; the MINOR-2 reveal-visibility remediation commit is `c4e20c5a571ec188232fa2379d580d067dedb87d`. Connected GitHub access created the existing Draft PR [#10](https://github.com/mrdzyn/bossforge/pull/10). Its pre-remediation reviewed HEAD was `4e2ee256ccb09347e143f76242dc9a106c5b8c1d`; the final exact review HEAD is the pushed branch tip identified in the final review request. The earlier invalid GitHub CLI token incident is historical evidence only. This work is presentation-only and does not start M2.

### M2-D — owner-supervised live Twitch and OBS acceptance (partial evidence)

- **Kickoff baseline:** verified `main@50d4523873873328847f3d4c830220a869788b96`. PR #14 closed/merged at this SHA after independent exact-head source/security PASS and 80 measured synthetic Chrome dashboard/overlay captures. The prior SVG branch report is retained as historical evidence below; its initial NOT TESTED Chromium note is superseded by the committed and audited `docs/visual-qa/m2c-svg/qa-2026-10-29/` results.
- **Preparation scope:** [M2-D runbook](M2-D-LIVE-TWITCH-OBS-ACCEPTANCE.md) sets independent gates for safe local deterministic regression, owner-controlled Twitch authorization, genuine `!vote` / `!hit` testing, fail-closed source/cooldown/disconnect, and native OBS acceptance. The owner authorized local QA in [PR #15](https://github.com/mrdzyn/bossforge/pull/15#issuecomment-6499359393); no deployment or public service is involved.
- **Historical preflight before this branch:** agent reported 262 tests passing when workspace suites ran separately (41 shared, 147 server, 74 web), 107 focused OAuth/EventSub/combat/security tests, frozen install/build/typecheck/lint and mock simulation. The initial concurrent SVG checksum timeout was resolved in a separate 15-second web-suite rerun; sandbox socket EPERM required authorized local reruns; `pnpm format:check` still flagged an ignored local `.kilo/agent-manager.json` file. These are agent-reported results on the earlier audited PR #14 branch, not rerun here.
- **Gate A deterministic preflight:** executed on PR #15 starting HEAD
  `63901d273029ad60ac429848b6731e934a65eb62`, based on main
  `50d4523873873328847f3d4c830220a869788b96`. Branch was clean at start.
  Node `v24.21.0`, pnpm `11.25.0`; frozen install, asset reproducibility,
  build, typecheck, lint, tracked-file Prettier, focused security tests and
  isolated mock simulation passed. All 262 package tests passed separately:
  41 shared, 147 server and 74 web. Focused OAuth/EventSub/battle/local-access
  regressions passed 107/107. See [ACCEPTANCE](ACCEPTANCE.md) for command-level
  outcomes and retry details.
- **Runner limitations:** sandbox full tests first hit eight localhost bind
  `EPERM` failures; the authorized local rerun passed all 147 server tests.
  The root `pnpm test` command still hit the web SVG checksum test's default
  5-second timeout while suites ran concurrently; the web suite passed 74/74
  when rerun alone with a 15-second timeout. Therefore the combined root
  command is not recorded as a single-command PASS. The asset check initially
  hit pnpm's noninteractive modules-directory guard, then passed with
  `CI=true`. Tracked-file formatting passed after Prettier normalized the
  runbook and this status file; ignored `.kilo/agent-manager.json` was not
  read or changed. The optional Phaser chunk-size warning remains.
- **Synthetic run:** the existing four-category simulation passed against a
  temporary Fastify server on `127.0.0.1:33307`, started with an empty
  environment allowlist and `TWITCH_INTEGRATION_ENABLED=false`. Two synthetic
  votes were accepted per category and Drake / Storm / Thunder Dash / Light
  was revealed. Ports 3001/5173 were not listening before or after and were
  untouched. This is mock evidence only.
- **Owner-supplied live results (2026-10-29):** four genuine Twitch voting
  stages produced Rime Veil (Wraith / Ice / Ember Burst / Water). One genuine
  `!hit water` changed authoritative HP from 550 to 536 with one accepted
  attack. Twitch itself rejected a duplicate identical command within 30
  seconds; this is **not** BossForge cooldown validation. Rime Veil expired
  as BOSS SURVIVED. A second boss, Cinder Granite (Golem / Fire / Thunder
  Dash / Water), was also displayed with a survived outcome. Owner-supplied
  screenshots show BossForge in an OBS stream beside Elevator, Please! These
  claims are not independently reproduced; see [ACCEPTANCE](ACCEPTANCE.md).
- **Observed Gate B:** local dashboard and sanitized EventSub diagnostics
  showed a verified welcome, one enabled chat subscription, connected Twitch
  status, and accepted/normalized live notification flow. The authenticated
  identity was privately checked and is omitted from this record. No OAuth
  values or private identifiers are recorded.
- **Remaining acceptance limits:** verified base 8 damage, BossForge-side
  cooldown rejection, community victory, active HP synchronization in native
  OBS, and native OBS source sizing/fit at both 1920×1080 and 1280×720 are not
  established by the supplied results. The screenshots are owner-supplied,
  not independent OBS reproduction. Hosted GitHub Actions remain
  **UNVERIFIED**. Gate A retains its documented aggregate-runner exception.

### Boss Motion V1 — CSS-only character presentation (Draft PR #18)

- **Original baseline:** `main@2893ba8b8d26de0fe032689c5ab69497f03a1486`.
  Branch `feat/boss-motion-v1` is reconciled with main at
  `fc95b1366deea38ceb67ee4c11db2883a053a272`, including merged PR #17.
- **Scope:** strengthen bounded idle and authoritative hit/weakness reactions
  for the four existing SVG characters, and fit the original art within the
  existing stage. CSS transforms, opacity, and a bounded weakness filter effect; no animation framework, server
  combat change, or change to Twitch/EventSub authority. Synthetic Chromium
  screenshots and observations are in `docs/visual-qa/boss-motion-v1/`.
- **Review target:** branch `feat/boss-motion-v1`; Draft PR
  [#18](https://github.com/mrdzyn/bossforge/pull/18), open and unmerged.
  Implementation commit: `d0d12c5fc84e097a240cbf589d0627f766a5a2d7`.
- **Validation status:** package tests, build, typecheck, lint, assets and
  isolated mock simulation passed on the implementation branch. The root
  parallel test runner had sandbox socket `EPERM` and a pre-existing web asset
  checksum timeout under parallel load; separate authorized package suites
  passed 264 tests. The ignored `.kilo/agent-manager.json` was not changed.
  Native OBS and genuine Twitch were not retested. See the QA README for the
  full command provenance and local runtime incident.

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

### M2-C — OBS battle HUD and full integration (historical implementation, merged)

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
- **Delivery at original review checkpoint:** implementation commit `b646f140354b9c3e7aad1f378d59139d057968dc`
  is on Draft [PR #13](https://github.com/mrdzyn/bossforge/pull/13), targeting
  the verified M2-B main baseline. Independent exact-head review is requested
  after the final documentation follow-up was pushed; PR #13 was subsequently
  squash-merged at `9c850eda69492a65f9cdf5ac3c9907c628055a98`.
- **M2-C audit remediation:** On the existing PR #13 branch, the exact-head
  review findings for stale overlapping overlay snapshots, Twitch-disconnect
  cancellation presentation, and impact-effect lifecycle were addressed.
  Overlay snapshot requests now use request/invalidation sequencing and allow
  at most two concurrent fetches; a newer validated WebSocket battle event or
  transport invalidation fences older HTTP responses. The overlay can show a
  fresh matching cancelled result with its fixed reason while the header says
  `TWITCH DISCONNECTED / VOTING PAUSED`; active HP and commands remain hidden.
  Hit and weakness effects reset on terminal/unavailable states, epoch or
  encounter change, and teardown. Added 13 web regressions (5 deferred-fetch
  hook tests, 5 mounted fake-timer tests, and 3 cancellation/disconnect
  presentation/composition tests). Chromium screenshots and measured bounds
  are recorded in `docs/visual-qa/m2c/README.md`. Node `v24.21.0` / pnpm
  `11.25.0`: frozen install, build, typecheck, lint, format, all **246 tests**
  (41 shared / 147 server / 58 web), four-category mock simulation, and diff check passed. The
  sandbox run had eight existing socket-binding `EPERM` failures; the full
  suite passed in the authorized local environment. Hosted Actions, real
  Twitch, and native OBS remain unverified. Original M2-C implementation is
  `b646f140354b9c3e7aad1f378d59139d057968dc`; audit-remediation commit is
  `c175f104189b378e16bebe21e89fc43ab2cadade`. PR #13 was Draft and unmerged
  at that checkpoint; it was later squash-merged at
  `9c850eda69492a65f9cdf5ac3c9907c628055a98`.
- **Follow-up exact-head re-audit fixes:** Overlay HTTP snapshot slots and
  abort controllers are now scoped to the WebSocket generation. Disconnect,
  reconnect and unmount abort old requests and immediately release only that
  generation's logical slots; late response and `finally` handlers cannot
  alter replacement-generation accounting or authority. The active generation
  remains capped at two requests. A mounted deferred-fetch regression keeps
  both G1 requests pending through disconnect, adopts a valid G2 snapshot, and
  then settles the retired requests without stale restoration. A subsequent G2
  poll remains available. The HUD clears the 520 ms weakness accent as soon as
  a normal accepted hit arrives while retaining its ordinary impact pulse;
  repeated weakness hits restart the accent timer and replacement encounters
  retire prior timers. Three new mounted regressions bring the full suite to
  **249 tests** (41 shared / 147 server / 61 web). Node `v24.21.0` / pnpm
  `11.25.0`, frozen install, build, typecheck, lint, format, tests, four-stage
  mock simulation and diff check passed. Sandbox socket/IPC restrictions were
  recorded; the authorized local test rerun passed. No new Chromium capture was
  taken for these request-accounting and animation-lifecycle changes; existing
  synthetic Chromium evidence remains as previously qualified. Hosted Actions,
  genuine Twitch and native OBS remain unverified. VecSynIQ animated SVG boss
  assets and the BossForge logo are the next approved development priority;
  M2-D was not started. Implementation commit:
  `7b27bc0e7d479ee98df69bec5e89f4332663ecb3`.

### M2-C — VecSynIQ SVG assets and UI polish (current branch)

- **Base:** `main` at `9c850eda69492a65f9cdf5ac3c9907c628055a98`, containing the
  M2-C PR #13 squash merge. Branch: `feat/m2c-svg-boss-polish`.
- The supplied Golem, Wraith, Drake, Mimic and BossForge logo originals passed
  ZIP manifest byte/SHA-256 checks, XML parsing and active/external-content
  checks. Deterministic production copies use pinned SVGO 4.0.0. The original
  source ZIP is retained outside the production public directory.
- A shared `AnimatedBoss` maps strict existing attributes to external SVG
  images. Neutral forging presentation remains in place until an authoritative
  reveal. CSS-only aura, reveal, bounded hit/weakness and terminal effects use
  validated battle presentation state; reduced motion is respected. The M2-A/
  M2-B server, combat rules, strict recipient projections and optional Phaser
  Arena were not changed.
- Asset size, source checksums and reproducible asset commands are recorded in
  [`docs/visual-qa/m2c-svg/README.md`](visual-qa/m2c-svg/README.md). A static
  source-art preview is saved there. It is not Chromium evidence.
- **Browser visual QA is NOT TESTED:** the available browser bridge is disabled
  in Work settings, so no actual viewport screenshots or browser bounds were
  captured. The isolated mock-only server/Vite smoke checks returned HTTP 200
  at `127.0.0.1:33305` and `127.0.0.1:5205`; the four-category synthetic
  simulation completed. Native OBS and live Twitch remain unverified.
- Validation on Node `v24.21.0` / pnpm `11.25.0`: frozen install, build,
  typecheck, lint and format check passed. Full suite: **262 tests** (41
  shared / 147 server / 74 web), including 13 new SVG/animation tests. The
  four-category synthetic mock simulation passed. The sandbox full-suite
  attempt hit 8 existing socket-binding `EPERM` errors; the authorized local
  rerun passed all tests. Isolated mock Fastify/Vite HTTP smoke checks passed.
  Exact-base production comparison: JS +2.60 kB raw / +1.15 kB gzip, CSS
  −0.84 kB raw / −0.52 kB gzip; Arena bundle unchanged. Optimized original
  character/logo SVGs reduced 65–69% gzip.
  Actual Chromium viewport QA remains **NOT TESTED** because local browser use
  is disabled in Work settings. Hosted CI is not claimed.

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

## Issue #16 — EventSub keepalive tolerance

Independent branch from main `2893ba8b8d26de0fe032689c5ab69497f03a1486`:
`fix/eventsub-jitter-allowance`. Owner-reported live voting cancellations at
30,250–30,251 ms match the former 250 ms watchdog boundary; the source of late
processing remains unknown. A fixed 2,500 ms allowance is tested against late
validated frames and genuine silence without weakening notification checks,
transport fencing, resubscription or fail-closed cancellation. No auto-resume.

Manual Node 24.21.0 / pnpm 11.25.0 validation: frozen install, build,
typecheck, lint, formatting, asset reproducibility, 84 focused tests and
isolated four-category mock simulation passed. All 270 tests passed separately
(41 shared / 155 server / 74 web). Root parallel test execution retained the
known SVG checksum timeout; a separate 15-second-timeout web rerun passed.
Hosted CI was not claimed at the remediation checkpoint. The owner's checkout,
private configuration, runtime ports and OBS were untouched by this work.
See [the incident evidence and owner retest procedure](M2-D-LIVE-TWITCH-OBS-ACCEPTANCE.md#issue-16--bounded-keepalive-jitter-remediation-2026-10-30).
The remediation was subsequently independently reviewed and squash-merged via PR #19 into main at `953c52f720bed59dc3ab2514054e6a954b4777ff`; Issue #16 is closed as completed. The owner-reported retest is recorded below.

## Issue #16 — owner-reported live reliability retest (2026-10-30)

[Issue #16's acceptance comment](https://github.com/mrdzyn/bossforge/issues/16#issuecomment-6504011541) records six owner-attested PASS checks: (1) Twitch connected with an enabled/verified EventSub subscription; (2) connection stability over 10 minutes with OBS and game load; (3) a four-stage forge with no reported watchdog cancellation; (4) accepted Twitch chat votes; (5) a deliberate disconnect cancelled a separate active encounter; and (6) reconnect did not automatically resume it. These are owner-reported observations, not independently reproduced results.

PR #19 was squash-merged into `main` at `953c52f720bed59dc3ab2514054e6a954b4777ff`; Issue #16 is closed as completed for the scoped watchdog remediation. The running-process SHA during the owner retest and exact before/after diagnostic counter deltas were not independently verified. No numeric snapshot or timestamped event log was supplied. The original cause of silence remains unknown; ten minutes of stability does not guarantee future availability.

M2-D end-to-end acceptance remains open: base-hit damage, BossForge two-second cooldown rejection, Community Victory, native OBS active-HP synchronization, native source sizing/fit and long-duration motion performance remain unverified. The previously observed dashboard/API terminal-state mismatch also remains unresolved. Owner-supplied OBS screenshots were not independently reproduced. The earlier deterministic tests and root parallel-test limitation remain historical evidence; hosted CI is unverified.

## Boss Motion V1 — reconciliation validation (2026-10-30)

PR #18 was reconciled with main `fc95b1366deea38ceb67ee4c11db2883a053a272`,
including merged PR #17 and Issue #16 history. The previously audited motion CSS,
web tests and visual QA files are unchanged from PR #18 head
`1b6bebe8da5853f6a23e0403489620d3cb8712e6`.

Manual CI in an isolated checkout used Node 24.21.0 and pnpm 11.25.0: offline
frozen install, build, typecheck, lint, format check, asset reproducibility,
19 focused motion/lifecycle tests and four-category mock simulation passed.
The root parallel test command passed 41 shared and 155 server tests but its web
SVG checksum test exceeded the default five-second timeout (75/76 passed). A
separate web rerun with `--testTimeout=15000` passed 76/76: all **272 tests**
passed across those runs. The root command is not claimed as a pass. Hosted CI
and new native OBS or live Twitch verification remain unverified. The mock
simulation used a disposable loopback-only server on port 33317 with Twitch
disabled; the owner's runtime and credentials were not touched.

## Weakness voting correction — proposed Draft PR

Based on `main@d649ec06614dcee52fdb3e6bca8ca5ff832fe561`. An accepted audience
ballot now determines the weakness winner, using the existing configured-order
tie breaker. A first empty weakness window opens one additional window of the
same duration; if it is also empty the authoritative forge becomes `failed`,
with no boss and no battle ready state. The dashboard explains the outcome
and permits an explicit reset/new cycle. The overlay is read-only and shows
the failure or retry without stale battle commands. Body, element and special
retain their existing no-vote defaults. Validated completed reveals reject
weakness defaults. Stale timer callbacks are fenced across windows and reset.

The dashboard and overlay require the current forge and battle identity, boss
ID and weakness to match before showing attack instructions; `!hit` still does
8 damage, the actual selected weakness 14, and a different known element 8.
No Twitch, security, damage authority or provider boundary is changed.

Node 24.21.0 / pnpm 11.25.0: offline frozen install, build, typecheck, lint,
format, asset reproducibility, 63 focused server tests, 19 focused UI tests,
and a four-category mock simulation passed. All 293 tests passed across
separate successful suite runs (42 shared / 170 server / 81 web). The root
parallel `pnpm test` passed shared and server but the web SVG checksum test
exceeded its default five-second timeout; the separate web suite passed with
`--testTimeout=15000`. Root parallel execution is not claimed green. Hosted CI,
new live Twitch and native OBS validation remain unverified. The owner runtime
and private configuration were not touched.
