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
