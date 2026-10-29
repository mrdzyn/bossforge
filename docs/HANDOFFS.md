# Execution handoffs

## Phase 0 — Codex x TwitchCon 2026

- **Bootstrap:** Confirmed that the remote had no refs before creating the
  authorized initial `main` commit. Bootstrap commit: `4190db4`.
- **Implementation branch:** `feat/phase0-foundation`.
- **Implementation commit:** `94506e09205f9aff27a5da29f8bdde9a90f6dc4c`, pushed
  successfully to `origin/feat/phase0-foundation`.
- **Scope:** Repository foundation and architecture only. No Phase 1 gameplay,
  real Twitch OAuth, EventSub, merge, deployment, release, or package publishing.
- **Original implementation commit:** `94506e09205f9aff27a5da29f8bdde9a90f6dc4c`.
  This is the initial Phase 0 implementation, not the current reviewed branch
  head.
- **Initial review head:** `8a6f456e89c68508e325588df2e25cd7feded2d0`.
  This is the branch head C1 reviewed before the bounded remediation below.
- **PR:** Draft PR [#1](https://github.com/mrdzyn/bossforge/pull/1) exists and
  was created through the owner's connected GitHub account. The C1 remediation
  code commit `7f69d9fd289ff34ccdba560eeb2dfa881ee0e12c` was pushed
  successfully, followed by the documentation and exact-viewport screenshot
  commits. The latest C2 audit reviewed `498f15d2dbf5d26755094b1d4e8576ad5ab92742`
  and identified C2-01. The C3 review target is the C2-remediated pushed branch
  tip, distinct from the original implementation and pre-C1 review heads.
- **C1 remediation:** WebSocket upgrades now accept only explicit local Vite
  development origins (or no Origin from a loopback client); simulation routes
  require development mode and a loopback peer even if the server bind host is
  changed; synthetic event submissions must use provider `mock`. Production
  WebSocket access still requires authentication and event authorization.
- **C2-01 bounded remediation:** Vite now fails during config loading unless
  `VITE_HOST` resolves to an explicit loopback address. Simulation POSTs require
  a loopback socket peer, exact local Vite Origin when present, and
  `Sec-Fetch-Site: same-origin` when Fetch Metadata is present; originless local
  CLI requests remain accepted. Authorization never uses forwarded-IP headers.
  The reported 404 was `/favicon.ico`, now served by the app's SVG favicon.
  `docs/visual-qa/dashboard-1440x900.png` contains a settled chat-feed row.
- **C2 verification:** The targeted server suite passed 29 tests at that
  review stage; total workspace suite passed 35. An actual Vite proxy smoke accepted a same-origin
  dashboard POST (`202`), rejected a foreign Origin (`403`) and rejected a
  cross-site Fetch Metadata request (`403`). `pnpm simulate` succeeded with
  originless loopback requests. An attempted Vite start with `VITE_HOST=0.0.0.0`
  exited during config loading before listening. See `ACCEPTANCE.md` for full
  required command results.
- **C2 remediation commit:** `c6ab2c7c727397ec010f9767c4a2a0585a67ee4c`, pushed
  to `origin/feat/phase0-foundation`. This is distinct from the later C3 audit
  head recorded below.
- **C3 audit:** The independent audit reviewed SHA
  `14d75fa7ca7c6a57ee6ce1f493176472681709e3`, confirmed the C1/C2 protections,
  and found that CLI `--host` could override the `VITE_HOST` check.
- **C3-01 bounded remediation:** A Vite `configResolved` guard checks the final
  effective `server.host` for dev-server `serve` after CLI options merge and
  before bind. The process-level test invokes `vite --host 0.0.0.0`, expects
  startup failure, and proves the same port can be rebound. Local host forms
  remain permitted. The patch was pushed to the existing feature branch.
- **C3 verification:** On the final C3 candidate, all requested install/build/
  typecheck/lint/format/test commands passed. The workspace has 36 passing tests
  (6 shared, 30 server). A normal local Vite proxy request returned `202`,
  foreign-Origin/cross-site POSTs returned `403`, and `pnpm simulate` completed
  the local mock sequence. The CLI override test proved nonzero Vite startup
  and successfully rebound its reserved port after exit. These are
  Codex-reported results, not independent CI results.
- **C4 review target:** The pushed `feat/phase0-foundation` branch tip on Draft
  PR #1. The PR description now distinguishes Codex-reported commands/browser
  QA from the independent C3 source audit and its finding.
- **C4 handoff:** Review the exact pushed branch tip on Draft PR #1 for the
  CLI-host override fix, full validation, PR-description reconciliation, and
  preservation of C1/C2 controls. Do not merge, deploy, implement Twitch
  authentication, or start Phase 1.
- **Visual QA:** Chromium screenshots and observations are committed in
  `docs/visual-qa/` and `ACCEPTANCE.md`.
- **Prior C1 validation:** On the C1 remediation worktree, `pnpm install
--frozen-lockfile --store-dir /workspace/.pnpm-store`, `pnpm build`,
  `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` all passed.
  The test suite passed 24 tests (6 shared and 18 server). See `ACCEPTANCE.md`.
- **Historical GitHub CLI result:** The original C1 `gh pr create --draft --base
main --head feat/phase0-foundation` failed with `Post
"https://api.github.com/graphql": Forbidden`; at that time CLI authentication
  also reported an invalid `GH_TOKEN`. In this C3 task `gh auth status` showed
  the owner's connected `mrdzyn` account, and `gh pr view` succeeded. The PR
  description records the current branch head, Codex-reported checks, browser
  evidence, and independent audit status. PR creation is not blocked. No new
  token was requested and no Codex environment settings were published. Do not
  merge.

## Owner decisions and external dependencies

- Twitch developer registration is currently blocked by the owner's account
  two-factor/mobile-number issue. Resolve that with Twitch Support before
  authorizing real Twitch integration.
- The owner retains merge approval. No merge is authorized in this handoff.
- Do not start Phase 1 or implement Twitch authentication under this C1
  remediation.

## Evidence integrity

Record actual commit SHAs, PR references, validation outcomes, and screenshots
only after they exist. Do not invent a Codex session ID; use the session's
`/status` command at handoff time if the identifier is not available here.

## Phase 1 — Audience voting and modular boss assembly

- **Authorized branch:** `feat/phase1-voting-boss-assembly`, based on kickoff
  HEAD `e40038f402985a92f496864dde62ef7d17124f18`. Draft PR #2 already exists;
  update that branch and PR rather than creating another.
- **Scope:** Four timed mock-only vote categories, mutable per-viewer ballots,
  deterministic results/fallbacks, server state snapshots and WebSocket
  updates, dashboard controls, read-only OBS voting/reveal, modular art,
  bounded deterministic stats, and repeatable local simulation. No combat,
  Twitch auth, merge, deploy, or Phase 2.
- **Security:** Preserve Phase 0 Vite effective-host checks, WebSocket Origin
  policy, local-only mutation Origin and Fetch Metadata checks, loopback peer
  checks, no forwarded-IP trust, mock-only events, production route absence,
  and rate limiting. P1 does not authenticate viewers and is not safe for public
  access.
- **Implementation:** The implementation is committed to the existing branch
  and pushed to the existing Draft PR #2. Implementation commit:
  `b4b31d6ec47c9e50457fc0e4e1967dd5b2c7349a`. The PR description and delivery
  record identify the current full HEAD SHA to review. Do not amend code after
  the reported SHA without updating the review target.
- **Validation (Codex-reported):** Frozen pnpm install, build, typecheck, lint,
  formatting check, and complete tests passed. The suite contains 44 passing
  tests (6 shared, 38 server). `pnpm simulate` completed repeated four-stage
  cycles, and Chromium exercised dashboard reset/restart plus the live overlay
  countdown and percentages. These results are not independent audit approval.
- **Browser evidence:** Real Chromium screenshots are in `docs/visual-qa/` at
  dashboard 1440×900 and 390×844, settled chat feed, and overlay 1920×1080 and
  1280×720. `docs/ACCEPTANCE.md` records scroll, overflow, labels, safe-area,
  readability, and the initial 1280 art-crop fix confirmed by the final capture.
- **C4 handoff:** Independently review Draft PR #2 at its current exact pushed
  branch head for voting correctness, event lifecycle/reconnection, visual
  assembly differences, complete local workflow, and preservation of all Phase
  0 security controls. Independent approval remains pending; do not merge,
  deploy, implement Twitch authentication, or start Phase 2.

## Phase 1 C5 — backend restart and state ordering

- **Audit input:** Independent C4 comment
  [6415746841](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6415746841)
  reviewed `d627491b06bac068d773313cf806676853664c97` and requested only the
  restart-epoch and delayed HTTP response fixes.
- **Remediation:** Forge snapshots and events now include a unique server
  instance ID and server start timestamp. Dashboard and OBS apply snapshots,
  WebSocket events, and mutation responses through the shared reconciler.
  Within one instance it accepts only nondecreasing revisions; it adopts a
  newer instance even at revision zero; it rejects earlier epochs and old
  socket generations. A two-second snapshot poll covers backend restarts where
  the Vite WebSocket proxy does not close the client socket. The repeatable CLI
  simulation now seeds its loop from the start response so a second run cannot
  print the previous revealed state as the result of the new run.
- **Implementation commit:** `5b6abc1984c73ab1168bb693450d126e5a0eee41`.
  Documentation and real Chromium captures are committed separately; the C5
  reviewer should inspect the latest exact PR #2 head after push.
- **Validation (Codex-reported):** Frozen install, build, typecheck, lint,
  format check, and complete tests passed: 49 tests (10 shared, 39 server).
  Two consecutive five-second synthetic cycles completed; both revealed the
  deterministic Thunder Tempest. Full Phase 0 local-only route and WebSocket
  security regression tests remain green. A real Chromium 154 backend restart
  smoke kept dashboard and OBS open: both discarded the old boss, adopted the
  new idle snapshot, and showed the new body vote after a fresh start. The
  intentional backend shutdown aborted several pending snapshot requests; the
  periodic retry recovered when the server returned.
- **Browser evidence:** Captures are in `docs/visual-qa/`: the pre-restart
  dashboard and OBS show the previous boss; the post-restart dashboard and OBS
  show the new body vote and no old boss. Exact paths and dimensions are
  recorded in `docs/ACCEPTANCE.md`.
- **Limitations:** Restart recovery may take up to the two-second polling
  interval after the backend is reachable. Epoch ordering assumes the local
  machine's wall clock advances between process starts. Simulation remains
  local development functionality; there is no Twitch authentication or public
  access authorization.
- **C5 review request:** Review the exact latest pushed HEAD on the existing
  Draft PR #2 for server epoch identity, centralized state freshness, polling
  recovery, stale response rejection, repeated simulation behavior, all
  preserved Phase 0 boundaries, and the recorded validation. This is a Codex
  handoff, not independent approval. Do not merge, deploy, publish, implement
  Twitch authentication or combat, or start Phase 2.

## Phase 1 C6 — revealed-stat layout polish

- **C5 approval preserved:** Independent review comment
  [6417063491](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6417063491)
  passed C5 at `1c836d9b7726a69ab559d342a4a3c283bdf2eb2a`, with a non-blocking
  note that revealed boss statistics touch the progress track.
- **Bounded fix:** In `apps/web/src/styles.css`, `.boss-stats` now has an 8px
  top margin and 1.4 line height. This restores the gap removed by the global
  paragraph top-margin reset. No React or OBS markup, state, security, voting,
  or reduced-motion rules changed.
- **Implementation commit:** `a0236e78e2d28e839d9e7ab49e05030e79f6518d`.
- **Validation (Codex-reported):** `pnpm build`, `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm test`, and `git diff --check` passed. The suite
  remains 49 tests (10 shared, 39 server). Real Chromium measured an 8px gap
  between progress and statistics at 1440×900 and 390×844. Idle/voting omitted
  the revealed-only statistics; no mobile horizontal overflow appeared. Both
  OBS sizes retained exact viewport-sized documents, safe labels, and no
  overflow. Reduced-motion emulation retained the 0.01ms transition setting.
- **Screenshots:** Actual Chromium captures are in `docs/visual-qa/` with names
  `c6-dashboard-1440x900.png`, `c6-dashboard-390x844.png`,
  `c6-overlay-1920x1080.png`, and `c6-overlay-1280x720.png`. C5 screenshots and
  review references remain preserved.
- **Limitations:** No C6 visual issue remained in the tested viewports. The
  inherited C5 wall-clock epoch ordering note remains; C6 did not alter it.
- **C6 review request:** Independently review the exact latest pushed HEAD on
  Draft PR #2 for this CSS-only spacing correction, screenshots/rectangle
  evidence, responsive behavior, and preservation of C5 approval and scope.
  Codex-run checks are not independent approval. Do not merge, deploy, publish,
  or begin Phase 2; owner approval is required before merge.

## Phase 1 merge and Phase 2 kickoff

- **Phase 1 merge verified:** Owner explicitly approved squash merge of [PR #2](https://github.com/mrdzyn/bossforge/pull/2) after independent C6 PASS ([comment #6417403432](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6417403432)). GitHub reports PR #2 merged into `main`; squash commit `2ca5c1ebcd0fe4f51b153faf36a8a765d66fec45`. Prior implementation head `3863a30088b82d52262e8624fb843d42f2d3595d`.
- **P2 owner authorization:** Begin the playable boss battle milestone; no Phase 2 merge/deploy/release authorization.
- **P2 new branch:** `feat/phase2-playable-boss-battle` created from the exact squash-merged Phase 1 `main` commit. Active spec: [P2-PLAYABLE-BOSS-BATTLE.md](P2-PLAYABLE-BOSS-BATTLE.md).
- **P2 kickoff scope:** Specs/status/handoff documentation first. Next work is an actual Phaser 3 combat vertical slice and subsequent full P2 acceptance in the same branch and its Draft PR; retain the Phase 0/1 source authority, client reconciliation, loopback-only security and mock simulation disclosure.
- **Review gate:** Codex implementation checks and screenshots are not independent verification. Request a new exact-HEAD audit on the Phase 2 implementation; leave its PR Draft and unmerged until the owner expressly approves squash merge. No Twitch OAuth, production endpoint, multiplayer, deployment or Phase 3 under this authority.

## Phase 2 — playable local boss battle

- **Scope delivered:** Phaser 3.90.0 lazy `/arena`; validated revealed-boss input; deterministic combat reducer; movement, mouse/Space attack, Shift dodge, health/collision, weakness ammunition, four telegraphed patterns, local victory/defeat, same-boss rematch, and fresh-forge navigation. No server combat route, battle persistence, Twitch integration, or Phase 3 work was added.
- **Lifecycle and reconciliation:** Arena state comes from the existing `useLiveEvents` hook and `ForgeStateReconciler`. It stops when no current authoritative snapshot is available or the forge identity ceases to be a revealed boss. Scene/game/input resources are disposed on identity change and unmount; game pauses while the document is hidden.
- **Validation:** Frozen install, build, typecheck, lint, Prettier, complete test suite and `git diff --check` are recorded in `docs/ACCEPTANCE.md`. Full suite: 56 tests (17 shared, 39 server). Real Chromium 154 screenshots document dashboard desktop/mobile, both OBS sizes, live battle, victory, same-boss rematch, and defeat. Browser page/console errors and failed HTTP responses: none observed.
- **Build note:** The lazy Phaser chunk is 1,220.68 KB raw / 336.90 KB gzip and triggers Vite's >500 KB advisory. It is code-split from the ~297.55 KB raw main bundle; no further chunk splitting has been done.
- **Limitations:** Client-side local simulation only; result not persisted or shared with OBS. Touch combat controls are not implemented. The full-flow interactive QA used the deterministic synthetic Thunder Tempest (Drake / Storm / Thunder-Dash / Light). No real Twitch connectivity was tested.
- **Screenshots:** Actual Chromium captures in `docs/visual-qa/p2/`: `p2-dashboard-1440x900.png`, `p2-dashboard-390x844.png`, `p2-overlay-1920x1080.png`, `p2-overlay-1280x720.png`, `p2-arena-in-progress-1440x900.png`, `p2-arena-victory-1440x900.png`, `p2-arena-rematch-1440x900.png`, and `p2-arena-defeat-1440x900.png`.
- **P2 review request:** Independently audit the exact pushed HEAD on existing Draft PR #3 for validated boss intake, lifecycle/restart behavior, reducer determinism and combat fairness, all four telegraphs, UI and screenshots, Phase 0 security preservation, and the actual validation record. Codex checks are not independent approval. Keep the PR Draft; do not merge, deploy, publish, release, implement Twitch auth, or begin Phase 3.

## P2-C2 — bounded remediation of C1 findings

- **Audit findings addressed:** Default-spawn ember safe gap, thunder dash and shadow pulse now threaten a stationary player while retaining visible, avoidable telegraphs; frost targets its telegraphed location and is evadable by strafing. Player hit feedback distinguishes actual weakness hits from ordinary hits.
- **Lifecycle:** React StrictMode Chromium runs showed one canvas per arena, no canvas after route exit/reset, stable one-canvas rematches, and frozen terminal state after victory/defeat. Phaser keyboard/pointer handlers are explicitly removed on terminal outcome and scene shutdown. Hidden/visible pause/resume was exercised with headless Chromium's `document.hidden` value emulated and the actual `visibilitychange` handler dispatched.
- **Backend process restart:** With the arena active, the Fastify process was terminated while the Chromium page and Vite server stayed open. The old canvas disappeared during outage; a replacement process with a new server instance returned idle, and the previous fight did not return. A fresh full mock simulation then mounted its boss on the new epoch.
- **Validation:** Frozen install, build, typecheck, lint, format, full tests, and `git diff --check` are recorded in the C2 section of `docs/ACCEPTANCE.md`. Current suite: 62 tests (23 shared, 39 server), retaining the 56-test C1 candidate. Real Chromium demonstrated stationary damage and successful evasion for all four specials, neutral and weakness hit feedback, victory, three repeated rematches, defeat, reset, route transitions, and process-restart recovery.
- **Evidence:** Real Chromium captures for four stationary/evasion telegraphs, feedback labels, active/recovered backend restart, victory, rematch, and defeat are in `docs/visual-qa/p2/c2/`. Headless Chromium did not support native OS tab hiding; visibility events were tested by overriding `document.hidden` and dispatching the real event.
- **Limitations:** Combat remains local-only and unpersisted; no touch controls, Twitch integration, multiplayer or public combat API was added. Independent C2 exact-head review is pending; this Codex validation is not approval. Keep existing Draft PR #3 unmerged and do not deploy, publish, or begin Phase 3.

## Phase 2 squash merge and Phase 3-A readiness kickoff

- **P2 completed:** Owner authorized squash merge of [PR #3](https://github.com/mrdzyn/bossforge/pull/3) after [independent C2 PASS](https://github.com/mrdzyn/bossforge/pull/3#issuecomment-6419685792) at implementation SHA `af9301f9c5bc8a06d89ad94feccf4036d0311445`. GitHub confirmed `main@7aa90c96133bfbc44f1809f5e89bb5c75fb892ce`, with PR #3 closed/merged. Codex-reported 62 tests; the independent audit was source/screenshot review, not a test rerun.
- **P3-A kickoff:** Owner directed `next` after P2 merge. Created `feat/phase3-twitch-readiness` from the exact P2 merge commit and added [P3 readiness specification](P3-TWITCH-INTEGRATION-READINESS.md). Kickoff commits contain docs only; no EventSub implementation, auth, network call or live Twitch test is claimed.
- **Transport decision:** Prepare the future _server-side outbound EventSub WebSocket_ for `channel.chat.message` v1. A user access token and Twitch-required read-chat permission will be required for P3-B. Official docs: https://dev.twitch.tv/docs/chat/authenticating and https://dev.twitch.tv/docs/eventsub/handling-websocket-events.
- **Existing source blockers:** `ForgeSession` rejects `provider: twitch`; shared `ForgeState` and event schemas are explicitly mock/simulated. P3-A must not work around these restrictions by relabeling Twitch fixture messages as `mock`. A versioned P3-B migration plus security review is required before real chat can vote.
- **P3-A next implementation:** Pure fixture parser/normalizer, injected deterministic EventSub session state machine, deduplication and scope/channel checks, tests, docs; zero real OAuth, connections, secrets or public routes. Preserve the Phase 0–2 local demo and all 62 previous tests.
- **P3-B hard gate:** Twitch 2FA/mobile number/app registration issue is unresolved. Real OAuth, app setup and EventSub subscription are **NOT TESTED / NOT AUTHORIZED**. Do not bypass verification; await independent explicit user approval after it is resolved.
- **Merge/release gate:** P3-A changes go through its existing Draft PR and exact-head review. Do not merge, deploy or publish without a separate explicit decision.

## Phase 3-A — offline Twitch EventSub readiness

- **Scope:** Added `EventSubChatNormalizer` for synthetic official-shaped `channel.chat.message` v1 packets and an injected `EventSubSession` harness. Neither is wired into Fastify, the Twitch stub, or `ForgeSession`; no socket, HTTP request, OAuth, token, subscription, credential, or live-vote path was added.
- **Normalizer guarantees:** Bounded serialized frame and text; validates channel condition, stable Twitch IDs, EventSub timestamp, type/version; emits `provider: "twitch"`; rejects malformed, unsupported, wrong-channel, duplicate, stale/future, and out-of-order messages. Nanosecond timestamps are normalized to shared ISO milliseconds.
- **Lifecycle coverage:** Fake transports/timers exercise welcome and connection timeout, keepalive, notifications, notification replay, WebSocket control ping/pong, reconnect URL handoff without dropping the old connection, resubscription planning after an unexpected disconnect, capped retry, revocation, and cleanup. Subscription plans are callbacks; no subscribe payload is sent over the socket.
- **Isolation/security:** A normalized Twitch fixture is rejected by the active mock-only ForgeSession without changing forge state. `simulated: true`, `connectedToTwitch: false`, and mock-only simulation endpoint validation remain intact. The test harness uses a `.invalid` fixture URL and zero live-network dependencies.
- **Validation:** Focused tests passed (23: 13 normalizer, 10 session). Frozen install, build, typecheck, lint, format, full 85-test suite, mock simulation and diff check passed; details are in the P3-A section of `docs/ACCEPTANCE.md`. UI was not changed, so browser QA was not applicable.
- **Limitations:** This is not Twitch connectivity, OAuth, an actual EventSub subscription, or live voting. Twitch access remains **NOT TESTED / NOT AUTHORIZED** and P3-B requires separate owner authorization.
- **Review:** Request an independent exact-head audit through existing Draft PR #4. Codex checks are not independent approval. Do not merge, deploy, publish, start Phase 4, or activate real Twitch integration.

## P3-A-C2 — bounded remediation of independent C1 findings

- **C1-01:** Fixtures now use the official two-field subscription condition: broadcaster ID plus configured authorized reader `user_id`. Both IDs are validated; reader mismatch fails closed, while chatter ID remains the viewer identity.
- **C1-02:** The session tracks welcome state per transport. Notifications require a successful welcome on that socket. A retry socket remains blocked until its own welcome; during server reconnect, the old welcomed socket can still deliver until replacement welcome. Closed, stale and revoked transports are ignored.
- **C1-03:** Control Ping still receives Pong and does not extend the welcome/keepalive deadline. Only valid welcome, structurally valid keepalive, and notification accepted by the injected validator refresh it. Malformed/rejected activity does not extend the timer. Tests cover sustained Ping, malformed frames, activity refresh and timeout/retry.
- **Validation:** Focused suites pass (30: 17 normalizer, 13 lifecycle). Full workspace validation passes with 92 tests (23 shared, 69 server), preserving the previous 85; frozen install, build, typecheck, lint, format, and `git diff --check` passed. Port 3001 was already occupied and left untouched; a loopback server on port 3013 returned health 200 and `BOSSFORGE_URL=http://127.0.0.1:3013 pnpm simulate` completed all four categories. Exact final SHA and independent review request are recorded on Draft PR #4.
- **Security boundary:** Synthetic fixture inputs and fake transports only. No Twitch endpoints, credentials, OAuth, subscription creation, new route, or live voting. Mock-only `ForgeSession`, `simulated: true`, and `connectedToTwitch: false` are preserved.
- **Review gate:** Request independent exact-head C2 review on existing Draft PR #4. Keep it open and unmerged; do not deploy, publish, start P3-B, or begin Phase 4.

## Phase 3-A squash merge and Phase 3-B owner authorization

- **Completed previous phase:** Owner explicitly approved squash merge of [PR #4](https://github.com/mrdzyn/bossforge/pull/4) following [independent P3-A-C2 PASS](https://github.com/mrdzyn/bossforge/pull/4#issuecomment-6421367210). Confirmed new `main@5adbd71f5378666e17b805617f37c3bb000505b8`; source HEAD reviewed was `cdc0162c64092439bf64ce7bfaf09d4ed3aec940`. P3-A baseline reports 92 Codex-run passing tests.
- **External blocker resolved:** Owner confirmed Twitch developer registration now works and created a Twitch application; a Client ID was communicated directly and must be configured locally. Do **not** place the Client ID, Client Secret or tokens into tracked files. Client Secret stays private; this chat does not contain it.
- **P3-B owner approval:** Explicitly approved starting a **new Draft PR for real local Twitch OAuth + EventSub integration**, without merge/deployment. Branch `feat/phase3b-live-twitch-integration` created from the P3-A squash-merged `main`. Active spec: [P3B-LIVE-TWITCH-INTEGRATION.md](P3B-LIVE-TWITCH-INTEGRATION.md).
- **Kickoff state:** This is a documentation/architecture authorization handoff. No Phase 3-B runtime/auth/connectivity implementation has yet been committed or tested. Owner must provide local secret in gitignored configuration and personally approve OAuth consent.
- **Callback planning:** `http://localhost:3001/auth/twitch/callback`, subject to an exact Twitch Console redirect check and safe loopback listener/port preflight; never kill unrelated port-3001 processes.
- **Implementation stages:** (B1) secure local authorization-code flow, state/CSRF/cookie, token validation/refresh in volatile memory; (B2) real WSS + Helix `channel.chat.message` subscription using a user token, fixing pending-reconnect guard; (B3) explicitly mode-scoped real voting + source-aware client contracts/UI/OBS; (B4) actual owner-run Twitch/manual browser evidence + independent exact-head audit. No production/public deployment or posting to chat.
- **Gates:** Preserve 92 existing tests, C5 epoch reconciliation, P2 gameplay, and default local mock simulation. Tests/mock fixture runs are not proof of real Twitch integration. Keep P3-B Draft and unmerged; no release, deploy, Phase 4 or squash without separate approval.

## Phase 3-B implementation and independent security handoff

- **Existing delivery target:** `feat/phase3b-live-twitch-integration`, existing Draft PR #5. No new branch/PR; keep Draft and unmerged.
- **Scope implemented:** Secure local authorization-code OAuth with single-use browser-bound state, local session/CSRF controls, volatile tokens and refresh/validation/logout; outbound EventSub WebSocket plus Helix `channel.chat.message` v1; provider-tagged Twitch ballots; dashboard connection controls; OBS-only mode/status disclosure; mock/Twitch mode isolation; pending reconnect socket cleanup.
- **Source identity:** Shared `ForgeState.mode` and `forge.state.source` now match the accepted provider. Twitch mode becomes connected only after EventSub welcome and verified active Helix subscription. A disconnect cancels current voting and prevents additional Twitch messages from changing state. Mode changes rotate the local server-instance identity to invalidate stale browser state.
- **Validation (Codex-reported):** Frozen install, build, typecheck, lint, format check, all 106 tests (23 shared / 83 server), `git diff --check`, and a local four-category `pnpm simulate` cycle passed. The test suite contains all 92 P3-A baseline tests plus 14 focused additions. Chromium 154 rendered dashboard desktop/mobile, both OBS sizes and the arena. Exact screenshots and measurements are in the P3-B section of `docs/ACCEPTANCE.md`.
- **Real account status:** OAuth consent, Twitch token validation/refresh against Twitch, Helix subscription, live EventSub traffic, and channel votes are **NOT TESTED**. All automated network calls use injected fake HTTP responses and fake WSS transports. No live Twitch endpoint was contacted.
- **Environment setup:** A cloud environment config draft was saved with `TWITCH_CLIENT_ID`, disabled-by-default `TWITCH_INTEGRATION_ENABLED=false`, a private user-provided `TWITCH_CLIENT_SECRET` requirement and Twitch egress domains. It is saved but not applied. Owner must review/publish the environment changes, confirm the exact callback in Twitch Console, provision the private secret outside Git, and personally initiate local OAuth before real acceptance.
- **Local QA ports:** Existing listeners on 5173 and 3013 were not modified. Validation ran the local apps at 5201 and 3201; this does not validate the fixed OAuth callback at port 3001.
- **Independent C1 review request:** Review the exact PR #5 HEAD at that checkpoint for OAuth state/cookie/CSRF/Host handling, token volatility and refresh/revocation, outbound-only WSS and Helix subscription sequencing, reconnect/orphan cleanup, reader/channel/replay validation, source/mode isolation, owner authorization on Twitch controls, accurate UI/OBS status, and the 106-test/security regression evidence. Distinguish code/fake-network coverage from real Twitch operation. That review identified the four findings addressed by P3-B-C2 below.
- **Remaining gates:** No merge, deployment, release, publishing or Phase 4. Live channel validation requires a separate owner interaction; independent security review must inspect the exact pushed HEAD.

## P3-B-C2 remediation handoff

- **Scope:** Fixed the four independent C1 findings on the existing
  `feat/phase3b-live-twitch-integration` branch and Draft PR #5. The feature
  remains disabled by default and the PR remains unmerged.
- **State ordering:** Mock/Twitch forge replacements receive a monotonic epoch
  and a fresh instance ID; transition snapshots are published. Real shared
  reconciliation tests reject stale prior-mode state, and the C5 backend
  restart regression remains green.
- **EventSub races:** Socket close/error state is transport-scoped and
  idempotent. Helix completion is bound to the currently welcomed session;
  deferred fake-network tests cover stale success, 409 verification, and error
  responses. Logout clears Twitch authorization and restores mock simulation
  without requiring another Twitch login.
- **Validation:** Frozen install, build, typecheck, lint, formatting, full test
  suite, mock simulation, Chromium dashboard/OBS/arena QA, local disabled OAuth
  preflight, and diff check are recorded in [ACCEPTANCE](ACCEPTANCE.md). The
  suite now has 110 tests (23 shared / 87 server), retaining the C1 106-test
  baseline.
- **Security boundary:** All Twitch tests use synthetic values, fake HTTP and
  fake WebSocket transports. No Twitch account, secret, OAuth consent, Twitch
  request, public endpoint or deployment was used. Live Twitch behavior remains
  **NOT TESTED**.
- **Independent review requested:** Please review the exact final pushed HEAD
  of existing Draft PR #5 for C1-01 through C1-04, C5 restart/reconciliation
  preservation, OAuth/default-deny/Origin boundaries, provider isolation and
  fake-network regression coverage. Review request is attached to PR #5.
  Keep Draft/open/unmerged; do not enable live integration.

## P3-B-C3 remediation handoff

- **Scope:** Resolve only C2-01 and C2-02 on the existing branch and Draft PR
  #5; retain all four C1 fixes and the C5 restart/reconciliation safeguards.
- **Timeout integrity:** Verified session loss, including internal keepalive
  timeout, invalidates subscription verification, immediately disables Twitch
  vote intake, publishes disconnected retry state, and safely cancels an active
  Twitch cycle. Deterministic scheduler tests do not depend on socket close.
- **Protocol integrity:** Welcome and revocation effects are committed only
  after lifecycle validation. Validated welcomes establish session leases;
  malformed welcomes/revocations do not poison a usable session. Server
  handoff and stale Helix completion checks remain covered.
- **Validation:** Frozen install, build, typecheck, lint, format, 112 tests (23
  shared / 89 server), four-category mock simulation, and `git diff --check`
  passed. Details are in [ACCEPTANCE](ACCEPTANCE.md#p3-b-c3--bounded-remediation-of-c2-findings).
- **Security boundary:** Synthetic values, fake HTTP/WebSocket transports, and
  fake timers only. No Twitch endpoint, account, credentials, OAuth consent,
  public endpoint, or deployment was used. Integration remains disabled by
  default.
- **Review gate:** Independent P3-B-C3 review is requested against the exact
  pushed HEAD of existing Draft PR #5. Keep it open and unmerged; do not enable
  Twitch, deploy, publish, or begin Phase 4.

## P3-B-C4 remediation handoff

- **Scope:** Fix only C3-01 on the existing branch and Draft PR #5, preserving
  C1/C2 remediations, keepalive-timeout handling, reconnect handoffs and
  verified Helix subscription gates.
- **Socket-loss ordering:** Active socket close/error now invokes
  `EventSubSession.disconnect()` before the adapter releases its current
  transport identity. The validated session-loss callback can therefore clear
  the active Helix lease and immediately publish disconnected/retry state.
  Error then close is idempotent; retired transport events do not affect a
  replacement.
- **Forge and recovery:** Server fake-socket coverage confirms the current
  Twitch forge is immediately disconnected and any active cycle returns to
  idle. Retry only restores connected after a fresh welcome and Helix response
  matching the replacement session ID.
- **Validation:** Frozen install, build, typecheck, lint, format, 113 tests (23
  shared / 90 server), `git diff --check`, and four-category synthetic mock
  simulation passed. Exact results are in
  [ACCEPTANCE](ACCEPTANCE.md#p3-b-c4--bounded-remediation-of-c3-01).
- **Security and review gate:** Fake sockets and HTTP only; integration remains
  disabled and no real Twitch traffic or credentials were used. Request
  independent P3-B-C4 review against exact pushed HEAD; keep Draft PR #5
  unmerged, with no deployment, publication or Phase 4 work.

## P3-B4-C5 EventSub disconnect handoff

- **Live evidence:** Owner-controlled QA observed OAuth completion, a verified
  EventSub subscription, HTTP 200 forge start, Body and Element voting with an
  advancing timer, then an EventSub disconnect that canceled voting. Reconnect
  restored the connection, not the cycle. A genuine notification and counted
  vote remain **NOT VERIFIED**.
- **Root cause:** **Unknown.** The live process did not collect close code or
  socket error classification, so transport loss cannot be distinguished from
  application keepalive expiry. The code schedules expiry at exactly the
  advertised timeout while Twitch guidance specifies silence longer than the
  timeout. This boundary is plausible but not confirmed; no speculative timer
  fix was made.
- **Bounded change:** Added default-off, volatile, owner-authenticated,
  loopback-only development diagnostics and fake-session tests. The endpoint
  is absent unless explicitly enabled in development; no public route or OBS
  data was added. It captures only reason enums, numeric close codes,
  allowlisted error classes, relative timings and bounded pipeline counters.
- **Validation:** 121 tests passed (23 shared / 98 server). Server build,
  typecheck, lint, formatting and diff check passed. The full server suite first
  hit sandbox socket `EPERM`, then passed in the authorized isolated local
  environment. Tests used fake sockets, deterministic clocks, and synthetic
  values; no live diagnostic was activated and no Twitch endpoint was called.
- **Next owner step:** Separately coordinate a local server restart to load the
  opt-in diagnostics setting; reauthorize in the browser because OAuth state is
  process-memory only. At `http://localhost:5173`, verify EventSub, select 60
  seconds per category, send one genuine Body vote, and compare sanitized
  counters with the authoritative vote total. Do not resume a canceled cycle.
- **Review gate:** Independent source review may assess the exact PR #5 head and
  fake-test evidence. Live root cause and end-to-end voting remain open. Keep
  Draft PR #5 unmerged; do not deploy, publish, or claim live-vote success.

## P3-B4-C5-R1 diagnostic browser compatibility handoff

- **Finding:** Address-bar GET navigation omits Origin, while the diagnostic
  endpoint correctly required it, making the documented browser workflow fail.
- **Correction:** Diagnostics use a read-only POST query with loopback,
  same-origin Origin, exact `Sec-Fetch-Site: same-origin`, and Twitch owner
  session checks. The endpoint remains disabled by default and is no-store.
  An owner-visible dashboard button sends the POST and renders only the
  sanitized counters; no data is exposed in OBS.
- **Validation:** Node v24.21.0 / pnpm 11.25.0; frozen install, build,
  typecheck, lint, format, 121 tests (23 shared / 98 server), four-category
  mock simulation, and diff check passed. Socket-binding tests needed the
  authorized local test environment after sandbox `EPERM`. See the R1
  [acceptance section](ACCEPTANCE.md#p3-b4-c5-r1--diagnostic-browser-compatibility).
  No authenticated server restart or real Twitch diagnostic query was performed.
- **Next gate:** After independent exact-head review, separately coordinate
  owner-controlled restart/reauthorization before enabling diagnostics and
  conducting the genuine 60-second Body vote check. Keep Draft PR #5 unmerged.

## P3-B4-C5-R2 EventSub keepalive remediation handoff

- **Live evidence preserved:** Owner-controlled sanitized diagnostics recorded
  5 validated welcomes, 5 enabled Helix subscriptions, 8 keepalives, 2 accepted
  EventSub notifications and normalized chat messages, 1 genuine ballot
  accepted, 1 rejected as `inactive-voting`, 4 keepalive-timeout disconnects,
  no socket closes/errors, and 1 canceled forge. The final disconnect measured
  10,001 ms against a 10,000 ms advertised timeout. This implicates the
  watchdog boundary; do not state that the post-fix live run passed.
- **Correction:** The first Twitch WebSocket URL asks for a 30-second keepalive
  timeout using Twitch’s supported query parameter. Every validated welcome’s
  timeout remains authoritative. The watchdog uses monotonic elapsed time,
  rechecks the newest validated keepalive/accepted notification, and provides
  250 ms of bounded grace before loss handling. Twitch reconnect URLs pass
  through unchanged. Verified loss still cancels voting and does not resume it.
- **Tests:** Fake-clock and fake-socket regressions cover boundary arrival,
  traffic inside grace, genuine expiry past grace, accepted notification timer
  reset, queued stale timer isolation, socket close, revocation/logout,
  reconnect URL preservation, and existing deduplication/session-lease rules.
- **Validation:** Node v24.21.0 / pnpm 11.25.0; frozen install, build,
  typecheck, lint, formatting, 124 tests (23 shared / 101 server),
  `git diff --check`, and a four-category mock simulation passed. The
  simulation ran against a separate disposable server on 127.0.0.1:3301. The
  full test suite needed the authorized local environment after sandbox socket
  binding tests hit `EPERM`. Hosted status checks were empty for the starting
  head; the local gates provide manual CI evidence.
- **Runtime/security:** Changes were made in a detached disposable worktree.
  The active authenticated server was not restarted. No OAuth, Twitch API or
  WebSocket request, real vote, credential read, public endpoint, merge,
  deployment or publication was performed.
- **Next step at that implementation checkpoint:** Owner-controlled live
  verification, later recorded below, and final exact-head review of the
  documentation-only evidence update. Keep PR #5 Draft and unmerged.

## P3-B4 C5-R2 owner-supplied live acceptance

- **Evidence source:** The following results were supplied by the owner after
  the implementation audit. They were not independently reproduced by
  automated tests. No application restart, OAuth or vote was initiated by
  Codex during this documentation update.
- **Connection:** PASS — OAuth/EventSub connected; 1 valid welcome, 1 Helix
  subscription enabled, 11 keepalives at an advertised 30,000 ms timeout,
  6 accepted notifications, 6 normalized messages, and 6 chat callbacks. No
  socket close/error, keepalive disconnect, or forge cancellation occurred.
- **Ballots and stages:** 3 genuine ballots accepted; 3 rejected (1
  `wrong-category`, 2 `invalid-choice`). All four stages completed, but this
  does not imply each category received an accepted genuine vote. Special
  used its default.
- **Forge and arena:** PASS — Cinder Granite revealed (Golem / Fire / Ember
  Burst default / Earth). Phaser terminal result: VICTORY, boss 0/120 HP,
  streamer 64/100 HP. Connection stability and complete forge-to-victory
  demonstration pass on the owner’s report. The P3-B live run did not include
  OBS application capture; separate P4A owner-supplied OBS visual QA is recorded
  below.
- **Chat syntax:** `!vote <category> <choice>`, with the category matching the
  active stage. The category choices are body (golem, wraith, drake, mimic),
  element (fire, ice, storm, void), special (ember-burst, frost-chain,
  thunder-dash, shadow-pulse), and weakness (water, light, earth, wind). Future
  UX should show the syntax and current valid choices in the overlay.
- **Independent automated evidence:** C5-R2 implementation validation at
  `279ff63fc803921310226d9c6903a029af7f0bd5` passed 124 tests (23 shared / 101
  server), build, typecheck, lint, format, diff check and mock simulation.
  These are code/test results, not the source of the live Twitch outcome.
- **Review gate:** Request final independent exact-head audit of the
  documentation-only commit below. Do not merge, deploy or publish.

## Phase 4-A — streamer voting UX and OBS readiness

- **Current base:** `main` at the PR #5 merge commit
  `76a5ddeeea0986aae2ed073deaeb1a5b02fb6280`. PR #5 is closed and merged;
  older P3-B handoff entries retain their historical open/Draft review status
  as it stood at each checkpoint.
- **Branch:** `feat/p4a-streamer-voting-ux`. Work is isolated from the owner's
  authenticated checkout and runtime.
- **Scope:** Dashboard and read-only overlay expose the active canonical
  category, exact valid `!vote` commands for verified live Twitch, human labels,
  countdown, totals, and a tie-aware current leader. Completed outcomes
  distinguish a community winner from a no-valid-votes default. Live,
  simulated, and disconnected states are labeled separately. No vote-submission
  UI was added to the overlay.
- **Security boundary:** The change does not alter OAuth, EventSub, vote intake,
  state routes, network binding, or production behavior. No authenticated
  runtime restart, OAuth, Twitch request, or real vote is part of this work.
- **Evidence status:** Phase 4-A frontend acceptance is PASS. Automated UI/helper
  tests and mock-mode Chromium QA are recorded in `docs/ACCEPTANCE.md`, separate
  from owner-supplied historical P3-B live results. The owner reports actual
  OBS Studio visual PASS at 1920×1080 and 1280×720, including native 1280×720
  Browser Source Properties, **Transform → Fit to Screen**, no scene-boundary
  clipping, SIMULATED disclosure, correct default labels, and no overlay
  administration controls. This evidence is owner-supplied and not independently
  reproduced; it does not establish new live Twitch voting, live HP
  synchronization, or continuous animation performance.
- **Validation:** Node v24.21.0 / pnpm 11.25.0; frozen install, build,
  typecheck, lint, Prettier, 149 tests (29 shared / 19 web / 101 server),
  four-category synthetic mock simulation, responsive browser checks and
  `git diff --check` passed at the C2 implementation checkpoint. The tests were
  previously run and are not rerun for this documentation-only closure. Phaser's
  existing large arena chunk emits a build-size advisory; the build succeeds.
- **Phase 5:** Submission preparations are recorded in the readiness guide;
  no video, footage, session ID, public submission, or publication is claimed.
- **Review gate:** Keep the Phase 4-A pull request Draft and unmerged. Request
  an independent exact-head review after validation and push. Do not deploy,
  publish, or start Phase 5.

### P4A-C1 — stale live-voting prompt remediation

- **Finding and correction:** The C1 audit found that cached
  `connectedToTwitch=true` forge state could keep live commands, counts, and a
  countdown visible after the dashboard/overlay lost its local event feed.
  The web hook now invalidates freshness on socket close/error and requires
  reconciled state from the current connection generation. Both Dashboard and
  OverlayPreview hide the cached forge presentation until the local feed is
  connected and a fresh authoritative state has been accepted.
- **User-visible state:** Local feed loss shows **SERVER LINK UNAVAILABLE / LIVE
  VOTE STATUS UNKNOWN**. Reconnection while awaiting a state refresh shows
  **WAITING FOR FRESH SERVER STATE / LIVE VOTE STATUS UNKNOWN**. An authoritative
  Twitch disconnect remains separate from local transport loss; mock mode
  remains labeled simulated. The overlay remains read-only.
- **Scope and evidence:** Frontend and regression tests only; no backend security
  boundary, OAuth, EventSub, vote intake, authenticated runtime, or live Twitch
  evidence changed. Actual Dashboard and OverlayPreview composition regressions
  cover live, feed loss with cached state, unavailable refresh, fresh reconnect,
  Twitch disconnect, mock mode, and overlay controls. Frozen install, build,
  typecheck, lint, format, 149 tests (29 shared / 19 web / 101 server),
  four-category synthetic mock simulation, and `git diff --check` passed. Gate
  details are in the P4A-C1 section of `docs/ACCEPTANCE.md`.
- **Review gate:** Keep existing PR #6 Draft and unmerged. Request an
  independent exact-head re-audit after commit and push. Do not deploy or begin
  Phase 5.

### P4A-C2 — mobile clipping remediation

- **Starting head:** `57baca8ffa6fd4ef5915fa1fa0caf59988859746` on the existing
  `feat/p4a-streamer-voting-ux` branch and Draft PR #6. Preserve the uncommitted
  C1 QA notes and screenshots in `docs/visual-qa/p4a-c1/`; C2 preserves its
  initial captures in `docs/visual-qa/p4a-c2/` and records final post-fix
  captures in `docs/visual-qa/p4a-c2-verified/`.
- **Correction:** Mobile dashboard controls can shrink and wrap without cutting
  button labels. The overlay uses a zero-minimum mobile grid track and bounded
  live-vote content. Desktop rules and all Twitch/OAuth/server security
  boundaries remain unchanged.
- **Browser evidence:** Dashboard checked at 360×800, 375×812, 390×844,
  430×932 and 1280×720; overlay checked at those sizes plus 1920×1080. Exact
  visible DOM bounds were checked at each CSS viewport. Connection-loss warning
  fits at 360px; the isolated mock server was restored after that check. Current
  screenshots and details are in the P4A-C2 section of `docs/ACCEPTANCE.md`.
- **OBS evidence:** The initial C2 interpretation treated an approximate
  640×360 on-screen appearance as a smaller source viewport and marked 1280×720
  pending. The owner clarified that Browser 2 Properties were already native
  1280×720 and **Transform → Fit to Screen** was applied; the appearance was
  preview/display scaling. This supersedes the pending assessment. Owner visual
  QA now passes at both 1920×1080 and 1280×720. See the final results in
  `docs/P4A-STREAMER-OBS-READINESS.md`; preserve the original misinterpretation
  above as audit history.
- **Validation:** Node v24.21.0 / pnpm 11.25.0; frozen install, build,
  typecheck, lint, formatting, targeted web tests (19), full workspace tests
  (149: 29 shared / 19 web / 101 server), four-category five-second mock
  simulation (2 synthetic ballots per category), and `git diff --check` passed.
  Visible bounds passed at all requested viewports; disconnect warnings fit at
  360px. The mock simulation is synthetic evidence only.
- **Delivery:** Commit and push this bounded fix, docs and preserved/new QA
  artifacts to the existing Draft PR #6 only. Request independent exact-head
  re-audit. Do not merge, deploy, publish or start Phase 5.

### P4A final acceptance closure

- **Current result:** PASS for the Phase 4-A frontend/overlay scope, including
  mobile clipping remediation and owner-verified OBS visual presentation.
- **Canonical voting UX:** `!vote <category> <choice>` uses only the currently
  active `body`, `element`, `special`, or `weakness` stage. The UI separates
  LIVE TWITCH, SIMULATED, Twitch disconnected, and local-server-unavailable
  states; live prompts require fresh authoritative state. Leaders are
  tie-aware, and completed results distinguish COMMUNITY VOTE from DEFAULT ·
  No valid votes. OBS remains read-only.
- **Evidence categories:** 149 automated tests previously passed (29 shared /
  19 web / 101 server); four-category mock simulation is synthetic; responsive
  results are Chromium visual QA; 1920×1080 and 1280×720 OBS results are
  owner-supplied application screenshots. Historical P3-B genuine Twitch
  results remain owner-supplied and are not new P4A live voting evidence.
- **Limitations:** OBS was tested in simulated mode. No new live Twitch voting,
  live HP synchronization, or continuous animation performance is established.
  The PDCP-001 `!hit` battle system is not implemented in PR #6.
- **Original review gate:** At the time of this final acceptance closure, PR #6
  was Draft and awaiting the final documentation delta audit and owner's merge
  decision. It has since been squash-merged into `main` at
  `5655dea53e3eba5425b6ead8926659a0bb72ae5e`. Preserve the acceptance evidence;
  do not deploy, publish, or submit Phase 5 materials.

## PDCP-001 — M0 Any-Game contract lock (historical planning handoff)

- **Current base:** `main` at `5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`.
  PR #7 is closed/merged at this head; the prior PDCP-001 planning PASS remains
  recorded at [`adfaa6f`](https://github.com/mrdzyn/bossforge/pull/7#issuecomment-6461839234).
- **Branch/scope:** `docs/m0-any-game-contract-lock`; docs-only M0. The contract
  lock is in `docs/M0-ANY-GAME-CONTRACT-LOCK.md`; current status and roadmap are
  reconciled. The accepted PDCP-001 spec is edited only to correct its now-stale
  current baseline/PR #7 status.
- **Sequencing:** M1-B presents the freshly revealed boss as **REVEALED —
  BATTLE COMING SOON** using fresh ForgeState only. It has no inferred battle
  state, HP/timer, Start Battle action, or chat damage. M2-A introduces
  authoritative `CommunityBattleStateV1`, BATTLE READY and owner Start Battle;
  M2-B adds hit routing. In the final flow, accepted cooperative chat attacks
  can yield COMMUNITY VICTORY; expiry is BOSS SURVIVED; disconnect/invalidation
  is CANCELLED. The Phaser local combat model remains optional and separate.
- **Provisional balance proposal:** 60/90/120-second choice (90 default), 8 base
  damage, 7/4 weakness multiplier rounded half-up to 14, 2-second accepted-hit
  cooldown, duration-by-band HP (low 100/150/200; medium 400/550/750; high
  1,000/1,500/2,000 HP), 8 accepted hits/s plus burst 16, 64-entry/500-ms
  queue, 10-minute/10,000-ID dedup, and 5,000 cooldown entries. Six attacker
  cohorts have perfect-cadence upper bounds and paced one-third-weakness sample
  arithmetic; queue/rate caveats are explicit. No simulation or tuning is
  claimed; owner approval remains pending.
- **M0-time blocking security contract:** At the locked baseline, normalized
  chat with viewer identity and text was broadcast through EventHub. The
  subsequently authorized M1-A implementation added strict recipient
  projections, aggregate dashboard activity and sentinel privacy tests; PR #9
  later squash-merged the work after the review gate. No `!hit`, authoritative
  battle HP, or profile implementation existed at this planning checkpoint.
- **Owner decisions:** Confirm balance/default-band choices, whether recognized
  but nonmatching elements apply base damage or are rejected, and the extent of
  attack aggregates shown in OBS. See the M0 contract's decision list.
- **M0-time delivery gate:** The M0 lock did not itself authorize
  implementation. M1-A was separately authorized and later merged; M1-B has
  since received separate presentation-only authorization. M2 remains outside
  the current scope. No merge, deployment, publication or submission was part
  of this historical planning handoff.

## M1-A privacy-safe outbound events — historical pre-remediation review checkpoint

At this historical checkpoint Draft PR #9 was open on `feat/m1a-privacy-safe-events`, based on M0 main
`d556ef124fb9c98ae6c0801c68c76e38ec83a18b`. The original source
implementation commit is `7eb556f5c17af426d155470ae11ff07afa3d6a0f`; the
independently audited checkpoint was `ec25b4a9bc2603f7a1fb0da2d960026fe38daf46`.
The initial cloud workspace's GitHub CLI `Forbidden` failure is historical:
connected GitHub access later created Draft PR #9. The GPT-6 audit found
MAJOR-1 (stale dashboard activity after feed loss) and MINOR-1 (stale current
status/PR metadata). This bounded remediation adds generation- and
server/cycle-aware aggregate reconciliation and reconciles those records.
The exact remediation head and actual validation results are recorded in
`docs/ACCEPTANCE.md` after push. No independent approval is implied.

The remediation validation ran at commit
`371d2934b6333623c366ed6f1a8460031bb9617f`; the linked PR shows the latest
branch head after this handoff documentation update. Request independent
GPT-6 review of that current PR head. The prior audit at `ec25b4a9` is not a
review of the remediation.

Please independently verify:

- `NormalizedChatEvent` has no path to browser serialization; recipient DTOs
  are explicit, strict at every nesting level, and validated immediately
  before sending.
- Dashboard/OBS routing is fixed by the server endpoint, cannot be changed by
  query/role input, and initial provider status is sent to one client only.
- Dashboard aggregates reveal no event-level viewer activity; counters are
  bounded, coalesced, and reset with forge/provider lifecycle changes. On the
  client they must also be hidden immediately on feed loss, isolated to the
  active connection generation, and withheld until fresh authoritative state
  and matching server/cycle aggregates arrive after reconnect.
- HTTP snapshots/mutation responses and diagnostics/log error handling do not
  carry raw identities, content, tokens, cookies, or uncontrolled errors.
- Sentinel tests inspect actual serialized frames and HTTP/log output and
  preserve accepted/rejected votes, provider isolation, OAuth ownership,
  reconnect/reset behavior, and P4A freshness.
- Run CI-equivalent commands and review browser evidence recorded in
  `docs/ACCEPTANCE.md`. GitHub Actions is currently unavailable; do not treat
  cloud checks as hosted CI.

At this historical checkpoint, Codex tests and browser captures were
implementation evidence and a GPT-6 exact-head review was pending. PR #9 was
subsequently accepted and squash-merged at
`bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`; that review and merge gate is
closed.

## M1-A merge and M1-B Generic presentation

- **M1-A closure:** PR #9 was squash-merged into `main` at
  `bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`. The old GitHub CLI `Forbidden`
  event is retained as historical context in ACCEPTANCE; it is not a current
  blocker. M1-A's strict recipient schemas, internal-only normalized chat,
  bounded dashboard activity, and feed/state freshness form the M1-B base.
- **M1-B branch:** `feat/m1b-generic-obs-states`, based on the exact merged
  main SHA above. Original M1-B implementation commit is
  `1cec6be2bf1bdfe75baaa5d7734ca351fa11e452`; MINOR-2 implementation commit is
  `c4e20c5a571ec188232fa2379d580d067dedb87d`. Connected GitHub access created existing
  Draft [PR #10](https://github.com/mrdzyn/bossforge/pull/10). The earlier CLI
  `Forbidden` response and invalid `GH_TOKEN` report are retained as historical
  environment evidence; PR creation is no longer pending. The first
  independent review covered pre-remediation HEAD
  `4e2ee256ccb09347e143f76242dc9a106c5b8c1d`. The final review request applies
  to the exact pushed branch tip reported with that request, separately from
  implementation commit `c4e20c5`.
- **Scope:** Generic dashboard and read-only OBS presentation only. State
  labels and reveal details use fresh authoritative public ForgeState. Reveal
  requires the complete server-authored four-category boss. The terminal text
  is `REVEALED — BATTLE COMING SOON`; the optional Arena link remains a separate
  local Phaser demo. No battle session, battle HP/damage/timer, Start Battle,
  `!hit`, profile loading, game inspection/control, or M2 implementation.
- **QA artifacts:** Actual Chromium screenshots and bounds are under
  `docs/visual-qa/m1b/`. `qa-results.json` records real process restart recovery
  from a revealed boss to a fresh revision-0 idle state and a new reveal, with
  no old boss restored. Native OBS and Twitch owner QA were not performed.
- **MINOR-2 remediation:** The exact `REVEALED — BATTLE COMING SOON` outcome is
  now rendered directly beside the visible boss heading while retaining the
  full completion panel. First-viewport 1440×900 Chromium evidence is
  `docs/visual-qa/m1b/dashboard-1440x900-revealed-postfix.png`; the measured
  status rectangle is x=305, y=643.5, width=201.296875, height=27 CSS pixels,
  entirely inside the viewport. The review HEAD is the final pushed PR #10
  branch tip reported in the review request; the implementation commit remains
  separately identified above. The audit request covers the exact pushed SHA.
- **Review handoff:** Existing Draft PR #10 is open. Independently review the
  exact pushed head for MINOR-1/2, the state matrix, authoritative reveal
  validation, restart and stale-state suppression, privacy/schema invariants,
  responsive Chromium evidence, and unchanged Arena behavior. Keep the PR Draft
  and unmerged; do not start M2, deploy, publish, or connect to live Twitch.

The prior review handoff above records the state at that checkpoint. PR #10 was
subsequently squash-merged into `main` at
`21953184fbd8f7034b680134b9b2efccbe40ab4e`; it is no longer Draft or open.

## M2-A — server-authoritative battle engine

- **Base and branch:** `main` at
  `21953184fbd8f7034b680134b9b2efccbe40ab4e` (including M1-B PR #10);
  implementation branch `feat/m2a-authoritative-battle-engine`.
- **Scope:** `CommunityBattleStateV1`, strict data-only Generic profile v1,
  server-owned `BossBattleSession`, complete forge reveal to ready, explicit
  owner Start Battle/cancel, server HP and deadline/terminal transitions,
  idempotent requests, privacy-safe battle EventHub projections, separate
  `BattleStateReconciler`, and minimal dashboard-only controls. Phaser remains
  independent.
- **Boundary:** No `!hit` intake, Twitch chat attack routing, battle effects or
  full OBS battle UI. No real Twitch requests, credentials, OAuth or live votes
  were used. M2-B remains separate and requires owner authorization.
- **Delivery:** Implementation commit
  `0e2cf394910629cc39467d1023647ec9032a77ee` was pushed and opened as Draft
  [PR #11](https://github.com/mrdzyn/bossforge/pull/11) against main.
- **Review:** Request independent GPT-6 exact-head review of the final pushed
  branch tip for state
  invariants, reveal and cancellation lifecycle, request idempotency, local
  authorization, recipient privacy, reconciliation, and regression coverage.
  Keep the PR Draft and unmerged.
- **Validation:** Node v24.21.0 / pnpm 11.25.0. Frozen install, build,
  typecheck, lint, Prettier, all 182 tests (33 shared / 118 server / 31 web),
  four-category simulation and `git diff --check` passed. Loopback socket tests
  passed in the authorized local environment after sandbox `EPERM`; hosted CI
  has not been represented as passing. Build retains the existing optional
  Phaser large-chunk advisory.
- **Hosted checks:** GitHub diagnostics returned no checks, statuses, or jobs
  for the PR head; hosted CI is not claimed as passing.
- **Evidence boundary:** Synthetic mock and fake-clock results do not establish
  genuine Twitch battle damage or native OBS rendering. No OAuth, Twitch API,
  credentials or live votes were used. M2-A does not establish M2-B chat damage
  or live battle acceptance.
- **Audit remediation:** On audited HEAD
  `e6370a950b260987f8afafd3968248969bb6e69b`, fixed MAJOR-1, MAJOR-2 and
  MINOR-1 only. Battle snapshots and Start requests bind the full authoritative
  forge epoch/mode/cycle; provider-switch integration tests cover reused
  `forge-1` identifiers in both directions, cancellation, fresh encounter IDs,
  and authenticated starts. Start/Cancel fetches capture generation and
  epoch/encounter/forge context at dispatch; deferred fetch plus fake-WebSocket
  tests reject retired G1 responses after same-process and new-process G2
  snapshots. The shared completed-reveal predicate checks category order,
  configured options, valid winners, boss attribute agreement, and valid
  no-vote defaults.
- **Remediation evidence:** Node v24.21.0 / pnpm 11.25.0. Frozen install,
  build, typecheck, lint, Prettier, 196 passing tests (39 shared / 121 server /
  36 web), four-category synthetic simulation, and `git diff --check` passed.
  The original 182 passing tests remain passing. Sandbox loopback/tsx IPC
  attempts failed with `EPERM`; the full suite and isolated mock simulation
  passed in the authorized local environment. GitHub diagnostics returned no
  checks/statuses for the final head; hosted CI is not claimed as passing.
- **Remediation delivery:** Implementation commit
  `e787b8167ae98c613f66d3b96e656ae94b10d4df` follows M2-A implementation
  commit `0e2cf394910629cc39467d1023647ec9032a77ee`. Documentation records this
  evidence in the follow-up commit; the final exact pushed HEAD is included in
  the PR re-audit request. Request independent GPT-6 exact-head delta re-audit
  on existing Draft PR #11. Keep the PR Draft and unmerged; do not start M2-B.

## M2-B — secure Twitch chat combat

- **Base:** `main` at `15a917e229813df6d6ee344aed766c606ec17749` (M2-A PR #11
  squash merge). Branch: `feat/m2b-twitch-chat-attacks`.
- **Implementation:** Strict bounded `!hit` parser and private
  `BattleAttackRouter` consume only validated current EventSub callbacks or
  loopback mock simulation events. `BossBattleSession` is the only damage,
  HP, aggregate, revision and victory authority. No public/browser damage route
  or Phaser path was added. Dashboard-only counts are fixed, aggregate and
  coalesced; the OBS projection remains read-only.
- **Synthetic end-to-end evidence:** Four mock fallback forge stages reached
  authoritative `ready`; owner Start created an active low/60-second battle;
  eight routed synthetic `!hit water` events produced `victory` at 0 HP with
  100 damage applied. A separate deadline regression accepted a receipt at
  monotonic 59,999 ms and excluded one at 60,000 ms. These are automated mock
  results, not genuine Twitch evidence.
- **Validation:** Node `v24.21.0`, pnpm `11.25.0`; frozen install, build,
  typecheck, lint, Prettier, and 218 tests (39 shared / 142 server / 37 web)
  passed. `pnpm simulate` completed four synthetic voting categories on an
  isolated loopback-only server with Twitch disabled. `git diff --check`
  passed. Socket-binding tests first encountered sandbox `EPERM`; authorized
  local reruns passed. The optional Phaser large-chunk advisory remains.
- **Security/evidence boundary:** No real Twitch API, OAuth, credentials,
  genuine chat hit, native OBS testing, hosted CI success, merge or deployment
  is claimed. Replay and cooldown identity remain process-local and bounded;
  diagnostics expose no viewer identity, chat text, IDs, tokens or secrets.
- **Delivery/review:** Implementation and final documentation commit SHAs will
  be recorded after commit. The implementation commit is
  `7f548d1f1c53a85da203115cac601fcc1028bfc2`. Push the final documentation
  follow-up to this branch and request independent GPT-6 exact-head review on
  its resulting PR head. Keep the single new Draft PR against `main` unmerged;
  M2-C remains deferred.
