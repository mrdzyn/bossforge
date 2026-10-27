# Phase 0 acceptance

Status vocabulary: **PASS** ran successfully; **FAIL** ran and failed;
**NOT TESTED** was not run or could not be observed. Update this matrix with
actual outcomes; do not infer a pass from a configured script.

## Required checks

| Criterion                                        | Verification                                                        | Result                                |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------- |
| pnpm workspace and frozen dependency install     | `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store` | PASS — pnpm 11.25.0                   |
| Production web and server builds                 | `pnpm build`                                                        | PASS                                  |
| TypeScript checks                                | `pnpm typecheck`                                                    | PASS                                  |
| ESLint checks                                    | `pnpm lint`                                                         | PASS                                  |
| Formatting                                       | `pnpm format:check`                                                 | PASS                                  |
| Unit/integration suite                           | `pnpm test`                                                         | PASS — 36 tests (6 shared, 30 server) |
| Server health response                           | `GET /health`                                                       | PASS — direct and through Vite proxy  |
| WebSocket delivers mock events                   | Server integration test; `pnpm simulate`                            | PASS — 4 synthetic events             |
| Dashboard and overlay routes serve the app shell | HTTP requests to `/` and `/overlay`                                 | PASS                                  |
| Dashboard and overlay browser rendering          | Chromium at requested viewports                                     | PASS — see Visual QA                  |
| Secret review                                    | Credential-pattern scan of project files                            | PASS — no matches                     |
| Patch whitespace                                 | `git diff --check`                                                  | PASS                                  |
| Feature branch commit and push                   | C3 remediation on `origin/feat/phase0-foundation`                   | PASS — pushed to existing branch      |
| Draft PR                                         | Draft PR #1                                                         | PASS — owner connected GitHub account |

## Visual QA

Chromium 154.0.8037.57 headless was launched with Playwright against the running
local Vite development app. Real screenshots are committed alongside this
document:

- Dashboard: [`dashboard-1440x900.png`](visual-qa/dashboard-1440x900.png) and
  [`dashboard-390x844.png`](visual-qa/dashboard-390x844.png).
- Overlay: [`overlay-1920x1080.png`](visual-qa/overlay-1920x1080.png) and
  [`overlay-1280x720.png`](visual-qa/overlay-1280x720.png).

Observed results: the dashboard connection label displayed `LIVE LINK` and
`LOCAL SIMULATION`; the Generate chat event button was enabled and produced one
feed row. The 1440×900 dashboard had no page overflow. At 390×844, content
extended vertically to 1617 px, scroll worked, and there was no horizontal
overflow. Dashboard content, including the activity feed and battle placeholder,
was reachable by scrolling. At both overlay sizes, horizontal and vertical
overflow were absent, the local simulation connection label was visible, and no
measured text overflow occurred. The top bar, boss card, voting card, activity
label, and safe-layout note all stayed within the measured 32 px horizontal and
20 px vertical inset. The voting options and keyboard hints are visible
placeholders; they are not active gameplay controls. Contrast and layout were
visually inspected; small muted metadata is lower contrast than primary text,
but main headings, status labels, and the primary action remained readable.
The reported 404 was reproduced as a request for missing `/favicon.ico`. The
app now declares and serves `public/favicon.svg`; a fresh Chromium load reported
no failed resources or console errors. The 1440×900 screenshot was recaptured
after generating a chat event and waiting 800 ms, past the 300 ms entrance
animation; the row had computed opacity `1`, and its viewer, message, and
timestamp were readable. The other viewport captures remain at exact requested
dimensions.

## Required test coverage

The suite should exercise shared event schema acceptance and rejection, event
envelope JSON round-trip, deterministic mock event generation and lifecycle,
health success and failure, WebSocket delivery, invalid event rejection,
oversized payload rejection, rate limiting, and connection-state reporting.

Firefox testing is out of scope. Browser automation should use Chromium if
available; otherwise mark browser testing NOT TESTED and report that limitation.

## Phase 1 — Audience voting and boss assembly

Status is recorded for the exact Phase 1 branch head in the handoff. These
results are Codex-run evidence, not independent audit approval.

| Criterion                                                                 | Verification                        | Result                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Frozen install, build, typecheck, lint, formatting, complete suite        | Workspace commands                  | PASS — frozen install, build, typecheck, lint, format, and test completed; 44 tests passed (6 shared, 38 server)                    |
| Timed four-stage server-authoritative voting                              | Forge session and integration tests | PASS — injectable scheduler transitions; real simulation completed four 5-second windows                                            |
| Mutable ballot, deterministic tie/fallback, replay/invalid/late rejection | Focused session tests               | PASS — 6 forge tests cover vote changes, ties, fallback, replay, invalid/non-mock/wrong/stale/future/late votes, and timer disposal |
| HTTP/WebSocket snapshots, two-client updates and reconnect                | Server integration tests            | PASS — two clients receive versioned state and reconnect reads the current snapshot                                                 |
| Local-only simulation and retained Phase 0 security                       | Existing plus targeted route tests  | PASS — remote/foreign-origin mutations rejected; local dashboard and originless CLI accepted; production routes absent              |
| Repeatable end-to-end synthetic forge cycle                               | `pnpm simulate`                     | PASS — multiple cycles completed; deterministic `Thunder Tempest` reveal after reset                                                |
| Desktop/mobile dashboard and two OBS sizes                                | Chromium visual QA and screenshots  | PASS — real captures and viewport checks at all four required sizes                                                                 |
| Independent review                                                        | C5 exact-head review on Draft PR #2 | PASS — C5 comment 6417063491 reviewed `1c836d9b7726a69ab559d342a4a3c283bdf2eb2a`; C6 UI review is pending                           |

Phase 1 QA screenshots use the requested viewport paths; the original Phase 0
captures are preserved under `p0-` filenames. Only real Chromium captures are
recorded. Screenshots show local synthetic data and do not demonstrate Twitch
connection or combat.

Chromium 154.0.8037.57 ran through the environment Playwright runtime against
the local Vite/Fastify app after a complete forge reveal. Captures: [dashboard
1440×900](visual-qa/dashboard-1440x900.png), [dashboard
390×844](visual-qa/dashboard-390x844.png), [settled chat
feed](visual-qa/dashboard-chat-settled.png), [overlay
1920×1080](visual-qa/overlay-1920x1080.png), and [overlay
1280×720](visual-qa/overlay-1280x720.png). All captured pages reported no
failed browser requests or console errors. Dashboard labels showed `LOCAL
SIMULATION` and `LIVE LINK`; reset/start controls were exercised, `Voting ·
BODY` appeared, and Start disabled while voting. The 1440×900 document measured
1440×1519 with vertical scrolling and no horizontal overflow. At 390×844 it
measured 390×1952; scrolling reached 1108 px with no horizontal overflow. After
an 800 ms settle, the synthetic feed row opacity was 1 and its viewer/message
text was readable. Both overlay documents matched their viewport dimensions,
showed the complete boss reveal and `SIMULATED / NOT CONNECTED TO TWITCH`, and
had no clipping. The safe-layout label bounds were x=1654–1868, y=1039–1050 at
1920×1080 and x=1014–1228, y=679–690 at 1280×720. Primary text and vote bars
were legible; small metadata remained lower contrast. The dashboard is
vertically scrollable and its controls and results remain reachable. A first
1280×720 pass exposed cropped art; the final capture follows the CSS correction.
The active overlay was also checked in Chromium: it displayed the server
category countdown (`VOTE: BODY · 15s`) and per-option percentages. The
dashboard `Forge again` action was exercised after a reveal and successfully
reset and opened the next body vote.

Focused tests cover malformed and spoofed command fields, mock-provider
enforcement, session lifecycle, mutable ballots, deterministic results,
event delivery to two clients, snapshot recovery after reconnect, loopback and
Origin protection, forwarded-IP spoofing, and production route absence. The
normal Vite proxy and originless CLI simulation path were exercised.

## C1 security regression coverage

Focused server tests verify that local Vite origins and local no-Origin clients
can subscribe, foreign origins and production-mode subscriptions are rejected,
loopback clients can use simulation controls, non-loopback peers cannot use
either control route, and simulated Twitch-provider events are rejected while
mock-provider events are accepted.

## C2-01 development-proxy regression coverage

Tests verify Vite's host resolver defaults to loopback and fails closed for
wildcard, remote, and ambiguous bind hosts. A process-level test runs real Vite
with a safe `VITE_HOST=127.0.0.1` and CLI `--host 0.0.0.0`, checks the nonzero
exit and guard diagnostic, then binds the same port to confirm Vite established
no listener. Local dashboard Origin plus
`Sec-Fetch-Site: same-origin` is accepted; foreign Origins and cross-site Fetch
Metadata are rejected; and an originless loopback CLI request is accepted.
Remote socket authorization remains based on `request.raw.socket.remoteAddress`;
tests include a spoofed `X-Forwarded-For: 127.0.0.1` paired with a remote peer
and confirm rejection. A direct Vite startup with `VITE_HOST=0.0.0.0` exits
before binding. Live Vite proxy requests with allowed Origin and same-origin
metadata returned `202`; foreign-Origin and cross-site requests returned
`403`. `pnpm simulate` sent the remaining mock sequence over originless local
requests and completed normally.

## C3-01 effective-host regression

The Vite plugin validates `config.server.host` in `configResolved` for the
`serve` command, after Vite merges CLI options and before the dev server binds.
The process-level regression proves `--host 0.0.0.0` cannot establish a listener.
Local `localhost`, IPv4 127/8, and IPv6 `::1` values remain accepted by the host
policy tests. The normal local dev server and proxy smoke passed after this
change.

The process-level regression uses an otherwise valid local
`VITE_HOST=127.0.0.1`, invokes the real Vite CLI with `--host 0.0.0.0` and a
reserved test port, expects a nonzero exit with the host-guard diagnostic, then
successfully binds the same port on `0.0.0.0` to prove no network listener was
left behind.

## C5 bounded remediation — backend restart and state ordering

The C4 review comment [6415746841](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6415746841)
identified stale revealed state after process restart and an HTTP mutation
response that could roll back a newer WebSocket state. Forge snapshots now
carry a per-process UUID and process start timestamp. The shared client
reconciler accepts a newer process epoch even at revision zero, orders states
within one process by revision, rejects earlier connection generations, and
rejects delayed snapshots from an older process epoch. Dashboard and OBS use
this same hook and freshness policy. A two-second local snapshot poll detects
backend replacement even if the Vite WebSocket proxy keeps its browser socket
open.

| Criterion                                                      | Verification                                      | Result                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Restart from old revealed revision N to new idle revision 0    | Server and shared reconciliation regression tests | PASS — prior process revealed at revision 5; new instance snapshot accepted at revision 0; immediate fresh body vote accepted at revision 1 |
| Delayed old connection and old process responses               | Shared reconciler tests                           | PASS — stale socket generation, lower same-instance revision, and delayed prior-epoch response all rejected                                 |
| HTTP/WebSocket/snapshot freshness, reset/start/category order  | Shared reconciler tests and browser smoke         | PASS — reset/start and all four category transitions keep newer state; old mutation response cannot roll it back                            |
| Phase 0 local-only security boundaries                         | Full server test suite                            | PASS — all existing route, Origin, loopback, mock-provider, WebSocket, and production restriction tests remain green                        |
| Frozen install, build, typecheck, lint, formatting, full suite | Workspace commands                                | PASS — C5 candidate has 49 tests total (10 shared, 39 server)                                                                               |
| Repeated four-category synthetic cycles                        | `BOSSFORGE_VOTE_SECONDS=5 pnpm simulate`          | PASS — repeated full cycles revealed deterministic Thunder Tempest                                                                          |
| Dashboard and OBS recovery after backend restart               | Chromium 154.0.8037.57, local Vite/Fastify        | PASS — both open pages removed the old revealed boss, accepted new idle state, then displayed the new body vote after start                 |
| Independent C5 review                                          | Existing Draft PR #2                              | PASS — comment 6417063491 approved the bounded remediation at `1c836d9b7726a69ab559d342a4a3c283bdf2eb2a`; C6 is separate and pending        |

Actual Chromium captures from the restart smoke are
[old reveal — dashboard](visual-qa/c5-before-restart-dashboard.png),
[old reveal — OBS](visual-qa/c5-before-restart-overlay.png),
[recovered cycle — dashboard](visual-qa/c5-after-restart-dashboard.png), and
[recovered cycle — OBS](visual-qa/c5-after-restart-overlay.png). The recovered
dashboard and overlay show the old boss removed and the new body vote active.
The intentional backend stop aborted several in-flight snapshot HTTP requests;
periodic polling succeeded after the backend returned. Recovery can lag backend
availability by up to the two-second poll interval. The existing local-only
simulation model remains development-only and is not authorized for remote or
public use; no Twitch connection or combat was tested.

## C6 bounded UI polish — revealed boss statistics spacing

The independent C5 review [6417063491](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6417063491)
recorded a small overlap between the revealed boss statistics and progress
track. The global paragraph reset set `margin-top: 0`; `.boss-stats` did not
restore spacing, so its line box began at the progress track's bottom edge.
The dashboard-only `.boss-stats` rule now adds an 8px top margin and explicit
1.4 line height. Idle and voting states do not render this paragraph; the OBS
uses a separate class and is unaffected. Reduced-motion styles were unchanged.

| Criterion                                           | Verification                                               | Result                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1440×900 revealed dashboard                         | Chromium 154.0.8037.57, real screenshot and DOM rectangles | PASS — progress box y=820–825; statistics y=833–847; 8px gap; no horizontal overflow                                            |
| 390×844 revealed dashboard                          | Chromium 154.0.8037.57, real screenshot and DOM rectangles | PASS — progress box y=978–983; statistics y=991–1005; 8px gap; width 390px with no horizontal overflow; full page height 1992px |
| Idle and voting dashboard                           | Real Chromium state/control smoke at desktop and mobile    | PASS — statistics paragraph absent in both states; ready and BODY voting labels render; no horizontal overflow                  |
| OBS overlay 1920×1080                               | Real Chromium screenshot and document bounds               | PASS — document exactly 1920×1080; safe label x=1654–1868, y=1039–1050; no overflow                                             |
| OBS overlay 1280×720                                | Real Chromium screenshot and document bounds               | PASS — document exactly 1280×720; safe label x=1014–1228, y=679–690; no overflow                                                |
| Reduced motion                                      | Chromium emulation and computed CSS                        | PASS — reduced-motion media query matched; primary-button transition remained 0.01ms                                            |
| Build, typecheck, lint, formatting, full test suite | Workspace commands                                         | PASS — 49 tests (10 shared, 39 server)                                                                                          |
| Independent C6 review                               | Existing Draft PR #2                                       | PENDING — request exact-head review; C5 PASS remains intact                                                                     |

Screenshots captured from the actual Chromium run:
[dashboard 1440×900](visual-qa/c6-dashboard-1440x900.png),
[dashboard 390×844](visual-qa/c6-dashboard-390x844.png),
[OBS 1920×1080](visual-qa/c6-overlay-1920x1080.png), and
[OBS 1280×720](visual-qa/c6-overlay-1280x720.png). The four browser pages
reported no failed requests or page errors. Before the fix, measured stats
`top` equaled progress `bottom` (0px gap); after the fix the gap is 8px in both
dashboard viewports. The mobile stats line wraps within the card width without
clipping. Existing C5 wall-clock epoch ordering remains a disclosed,
non-production limitation; this presentation-only change does not affect it.

## Phase 2 — local playable boss battle

The following checks were run against the Phase 2 working tree. They are
Codex-reported engineering and browser evidence, not independent approval.

| Criterion                                 | Verification                                                                                      | Result                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser version and lazy route             | `apps/web/package.json`, production Vite build                                                    | PASS — exact `phaser@3.90.0`; `/arena` is a separate lazy chunk; dashboard chunk remains 297.55 KB raw (87.99 KB gzip), arena chunk 1,220.68 KB raw (336.90 KB gzip)                                                                                  |
| Validated forge reveal and lifecycle      | Revealed snapshot schema; Chromium local reset smoke; existing C5 epoch reconciler tests          | PASS — only revealed states with a complete boss validate; browser reset returned HTTP 200, removed the Phaser canvas, and showed the unavailable path; C5 tests accept new-process idle revision 0 and reject stale prior-process responses          |
| Combat behavior                           | Shared deterministic reducer and snapshot schema tests                                            | PASS — exact forged starting health/stats, 12 vs 21 damage for normal vs matching weakness ammo, all four telegraphs/patterns, dodge cooldown/invulnerability, damage, victory/defeat, terminal-state immutability, and invalid arena-state rejection |
| Full four-category workflow               | `pnpm simulate`                                                                                   | PASS — synthetic votes submitted for body, element, special, weakness; deterministic result was Thunder Tempest, Drake / Storm / Thunder-Dash / Light, 250 HP, 24 damage, 1600 ms cadence                                                             |
| Chromium interactive victory              | Chromium 154.0.8037.57, actual keyboard/mouse input at 1440×900                                   | PASS — selected Light weakness ammo, aimed and fired at the boss, boss health reached 0, streamer victory shown                                                                                                                                       |
| Rematch and defeat                        | Same browser session; rematch button, movement into dash path, then no attacks                    | PASS — health reset to 250/250 and 100/100 for the same boss; second battle ended in community victory with streamer health 0                                                                                                                         |
| Dashboard/OBS responsive regressions      | Chromium 154.0.8037.57                                                                            | PASS — dashboard 1440×900 and 390×844; OBS 1920×1080 and 1280×720; no horizontal overflow; idle/voting/revealed dashboard paths retained                                                                                                              |
| Browser errors                            | Chromium console, page exceptions, HTTP responses                                                 | PASS — no page errors, console errors, or HTTP error responses observed                                                                                                                                                                               |
| Frozen install                            | `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store`                               | PASS — lockfile verified, all workspace projects up to date                                                                                                                                                                                           |
| Build / typecheck / lint / format / tests | `pnpm build`; `pnpm typecheck`; `pnpm lint`; `pnpm format:check`; `pnpm test`; `git diff --check` | PASS — all commands passed; 56 tests total (17 shared, 39 server), retaining the 49-test Phase 1 baseline                                                                                                                                             |

Real Chromium screenshots are in [visual-qa/p2](visual-qa/p2/):
[dashboard 1440×900](visual-qa/p2/p2-dashboard-1440x900.png),
[dashboard 390×844](visual-qa/p2/p2-dashboard-390x844.png),
[OBS 1920×1080](visual-qa/p2/p2-overlay-1920x1080.png),
[OBS 1280×720](visual-qa/p2/p2-overlay-1280x720.png),
[battle in progress](visual-qa/p2/p2-arena-in-progress-1440x900.png),
[victory](visual-qa/p2/p2-arena-victory-1440x900.png),
[same-boss rematch](visual-qa/p2/p2-arena-rematch-1440x900.png), and
[defeat](visual-qa/p2/p2-arena-defeat-1440x900.png). Screenshots were captured
from actual Chromium sessions and were not generated or edited.

Remaining limitations: combat is local client-side simulation; battle results
are not persisted or shared with OBS, and touch combat controls are not
implemented. The Phaser arena chunk triggers Vite's >500 KB advisory (about
1.22 MB raw / 337 KB gzip), although it is not downloaded by dashboard/OBS
routes. Twitch auth/EventSub, multiplayer, production authorization, and Phase 3
remain out of scope. Independent Phase 2 review is pending at the exact pushed
HEAD; Codex-run checks do not constitute approval.

## P2-C2 bounded remediation — C1 fairness, feedback, and lifecycle findings

This is Codex-run validation for the C2 remediation, not independent approval.
The original C1 review was a source/screenshot audit; the checks below include
fresh reducer tests and live Chromium interaction.

| Criterion                                                    | Verification                                                                          | Result                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stationary default-spawn danger and evasion for each special | `packages/shared/test/combat.test.ts`; Chromium 154.0.8037.57                         | PASS — ember-burst, frost-chain, thunder-dash and shadow-pulse each reduced stationary player health from 100 to 76; telegraph-time lateral/dodge evasion kept health at 100 for each                                                                                      |
| Ember safe gap                                               | Reducer and Chromium                                                                  | PASS — gap is offset from the default player's bearing and shown by the dark sector; a lateral dash reaches the gap                                                                                                                                                        |
| Frost-chain target behavior                                  | Reducer and Chromium                                                                  | PASS — staggered bolts follow the position shown during telegraph rather than retargeting a moving player; lateral movement evaded the volley                                                                                                                              |
| Thunder-dash reach                                           | Reducer and Chromium                                                                  | PASS — 700-unit/s dash crosses the default-spawn collision radius; lateral dodge during the line telegraph avoids damage                                                                                                                                                   |
| Shadow-pulse reach                                           | Reducer and Chromium                                                                  | PASS — expanding ring reaches a 430-unit radius and crosses the default spawn; timed lateral dodge during the active ring avoids damage                                                                                                                                    |
| Damage feedback correctness                                  | Reducer tests; real browser attacks                                                   | PASS — nonmatching ammo records/shows neutral `HIT`; matching ammo records/shows `WEAKNESS HIT · BONUS DAMAGE`; banner remains absent until a projectile collision                                                                                                         |
| StrictMode and canvas lifecycle                              | React root source and Chromium 154                                                    | PASS — React `StrictMode` is active; each active arena had exactly one canvas; dashboard/arena transitions removed and recreated the canvas without duplicates                                                                                                             |
| Rematch and terminal cleanup                                 | Chromium actual keyboard/mouse combat                                                 | PASS — three consecutive same-boss rematches restored full boss health and one canvas; terminal results stayed frozen; a no-attack rematch reached defeat; reset removed the canvas                                                                                        |
| Input handler cleanup                                        | Phaser scene shutdown/terminal cleanup and repeated browser rematches                 | PASS — ammo key handler and pointer handler are removed at terminal state and scene shutdown; no duplicate canvas or repeated combat state was observed                                                                                                                    |
| Hidden/visible lifecycle                                     | Chromium headless DOM visibility-event emulation                                      | PASS — dispatching hidden paused combat health for 3.2 seconds; dispatching visible resumed it and the next dash hit registered. Headless Chromium did not expose an OS-level hidden tab, so the `document.hidden` property was emulated before dispatching the real event |
| Backend process restart while arena active                   | Isolated local Fastify process kill/restart with Chromium page open                   | PASS — active arena canvas removed during outage; replacement process returned a new server instance at idle with no old boss/canvas; a fresh `pnpm simulate` cycle mounted the new revealed boss on that instance                                                         |
| Frozen install / full workspace checks                       | Frozen pnpm install, build, typecheck, lint, Prettier, full tests, `git diff --check` | PASS — full suite has 62 tests (23 shared, 39 server), retaining all 56 tests from the C1 candidate                                                                                                                                                                        |

Actual Chromium evidence is in [visual-qa/p2/c2](visual-qa/p2/c2/): stationary
and evasion telegraphs for
[ember-burst](visual-qa/p2/c2/ember-burst-stationary-telegraph.png),
[frost-chain](visual-qa/p2/c2/frost-chain-stationary-telegraph.png),
[thunder-dash](visual-qa/p2/c2/thunder-dash-stationary-telegraph.png), and
[shadow-pulse](visual-qa/p2/c2/shadow-pulse-stationary-telegraph.png); neutral
and weakness feedback ([HIT](visual-qa/p2/c2/neutral-hit-feedback.png),
[bonus](visual-qa/p2/c2/weakness-hit-feedback.png));
[active battle before process restart](visual-qa/p2/c2/active-before-backend-restart.png),
[new idle epoch](visual-qa/p2/c2/idle-after-backend-restart.png),
[fresh arena recovery](visual-qa/p2/c2/fresh-arena-after-backend-restart.png),
[victory](visual-qa/p2/c2/victory.png), [rematch](visual-qa/p2/c2/rematch-victory.png),
and [defeat](visual-qa/p2/c2/defeat.png). Images are real Chromium captures.

Remaining limits are unchanged: local client-side combat only, no persisted or
OBS-shared battle result, no touch controls, and no real Twitch connectivity.
Independent C2 exact-head review is pending.

## P3-A offline EventSub foundation

This is fixture-only validation. It does not represent a Twitch connection,
OAuth run, live subscription, or live vote. No browser surface changed.

| Criterion                                               | Verification                                                                          | Result                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official-shaped `channel.chat.message` v1 normalization | `apps/server/test/eventsub-normalizer.test.ts`                                        | PASS — validates synthetic fixtures, maps stable user/message IDs and nanosecond timestamps, retains `provider: "twitch"`, and rejects malformed, oversized, unsupported, wrong-channel, duplicate, stale/future and out-of-order inputs            |
| Forge isolation                                         | Normalizer/ForgeSession integration test                                              | PASS — normalized Twitch fixture is rejected by mock-only ForgeSession and does not change state or `simulated` / `connectedToTwitch` flags                                                                                                         |
| Offline EventSub lifecycle                              | `apps/server/test/eventsub-session.test.ts`                                           | PASS — welcome/connection timeout, keepalive, notifications, replay prevention, control ping/pong, server reconnect handoff, resubscription planning after disconnect, bounded retries, revocation and shutdown use injected fake transports/timers |
| No live Twitch network dependency                       | Source and test harness inspection                                                    | PASS — components are not wired into the app; tests inject fake transports and use reserved `.invalid` fixture URLs; no Twitch credentials or API/socket calls are used                                                                             |
| Existing Phase 0–2 checks                               | Frozen install, build, typecheck, lint, format, full suite, simulation and diff check | PASS — actual outcomes are listed below                                                                                                                                                                                                             |

Validation results:

- `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store` — PASS.
- `pnpm build` — PASS; Vite retains the existing lazy Phaser chunk advisory.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — PASS.
- `pnpm test` — PASS, 85 tests total (23 shared, 62 server), preserving all 62
  P2 tests. Focused P3-A tests: 23 (13 normalizer, 10 lifecycle).
- `BOSSFORGE_PORT=3013 pnpm --filter @bossforge/server dev` started the local
  server on loopback, `/health` returned 200, and
  `BOSSFORGE_URL=http://127.0.0.1:3013 pnpm simulate` — PASS; completed all four
  synthetic categories and revealed Thunder Tempest. The temporary server was
  stopped afterward; the already-occupied default port was left untouched.
- `git diff --check` — PASS.

Real Twitch connectivity, OAuth, subscription, and live voting are **NOT
TESTED** and remain unauthorized. Independent exact-head review is pending.

## P3-A-C2 bounded remediation of C1 findings

This section supersedes the initial P3-A check counts above for the current
candidate. It remains entirely offline and does not enable live Twitch votes.

| Finding                          | Focused verification                                                                  | Result                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorized chat-reader condition | `apps/server/test/eventsub-normalizer.test.ts`                                        | PASS — realistic v1 fixture requires both broadcaster and `user_id`; configured reader is validated; missing, malformed and mismatched reader IDs reject, while `chatter_user_id` remains the viewer identity |
| Per-transport welcome gate       | `apps/server/test/eventsub-session.test.ts`                                           | PASS — pre-welcome, retry-before-welcome and pending-reconnect notifications reject; old welcomed socket remains usable until replacement welcome; closed and revoked socket events reject                    |
| Keepalive/Ping semantics         | `apps/server/test/eventsub-session.test.ts`                                           | PASS — Ping returns Pong without deadline extension; malformed frames and rejected notifications do not refresh; valid welcome, empty keepalive and accepted notification refresh; timeout enters retry path  |
| Mock-only behavior               | Normalizer plus `ForgeSession` regression and existing server security tests          | PASS — Twitch normalized fixture cannot mutate live mock session; `simulated: true`, `connectedToTwitch: false`, and mock-only simulation validation remain unchanged                                         |
| Full validation                  | Frozen install, build, typecheck, lint, format, full tests, diff check and simulation | PASS — actual outcomes are listed below                                                                                                                                                                       |

Validation results:

- `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store` — PASS.
- `pnpm build` — PASS; Vite reports the existing lazy Phaser chunk size advisory.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `git diff --check` — PASS.
- `pnpm test` — PASS, 92 total (23 shared, 69 server), preserving all 85
  pre-remediation P3-A tests. Focused C2 suites: 30 (17 normalizer, 13
  lifecycle).
- With the local development server running on loopback port 3013,
  `BOSSFORGE_URL=http://127.0.0.1:3013 pnpm simulate` — PASS; completed all
  four synthetic categories and revealed Thunder Tempest. Port 3001 was occupied
  by an existing process and was left untouched; the temporary server was
  stopped after the smoke run.

No browser UI changed. No Twitch endpoints, credentials, OAuth, subscription
creation, or public endpoints were used. Real Twitch access remains **NOT
TESTED** and P3-B is not authorized. Independent exact-head C2 review is pending.

## Phase 3-B — local OAuth, EventSub and provider-aware voting

All results below are Codex-run evidence for the P3-B implementation candidate;
none is an independent security approval.

| Criterion                             | Verification                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen workspace dependencies         | `pnpm --config.store-dir=/workspace/.pnpm-store install --frozen-lockfile`                                           | PASS — lockfile verified and install completed with pnpm 11.25.0                                                                                                                                                                                                                                                                                               |
| Build and types                       | `pnpm --config.store-dir=/workspace/.pnpm-store build`; `pnpm --config.store-dir=/workspace/.pnpm-store typecheck`   | PASS — shared, server and web build/typecheck completed; Vite reports the existing lazy Phaser chunk advisory (~1.22 MB raw / 337 KB gzip)                                                                                                                                                                                                                     |
| Lint and formatting                   | `pnpm --config.store-dir=/workspace/.pnpm-store lint`; `pnpm --config.store-dir=/workspace/.pnpm-store format:check` | PASS — ESLint and repository-wide Prettier check passed                                                                                                                                                                                                                                                                                                        |
| Complete regression suite             | `pnpm --config.store-dir=/workspace/.pnpm-store test`                                                                | PASS — 106 tests (23 shared, 83 server), retaining all 92 P3-A tests                                                                                                                                                                                                                                                                                           |
| OAuth security                        | `apps/server/test/oauth.test.ts`; local callback/guard integration tests                                             | PASS — opt-in, exact redirect, state mismatch/replay, denial, duplicate callback parameters, client/scope/identity validation, refresh rotation, logout/revocation, no-origin/unauthenticated controls; all network calls injected and fake                                                                                                                    |
| EventSub integration                  | `apps/server/test/live-eventsub.test.ts`; P3-A normalizer/session tests                                              | PASS — no forwarding before welcome and active subscription; Helix identity/token/session payload checked; rejected subscription fails closed; expired-token 401 refresh retries once; unexpected socket loss creates a new verified subscription; replay, channel and reader rejection remain covered                                                         |
| Provider isolation and local security | `apps/server/test/forge-session.test.ts`, `server.test.ts`, existing Phase 0 tests                                   | PASS — Twitch mode rejects mock ballots and mock event-generation/injection routes while authenticated start/reset remains available; Twitch controls require owner cookie plus exact local Origin/Fetch Metadata; default mock/CLI simulation protections remain green                                                                                        |
| Synthetic simulation                  | `BOSSFORGE_URL=http://127.0.0.1:3201 pnpm --config.store-dir=/workspace/.pnpm-store simulate`                        | PASS — all four vote categories received two synthetic votes; deterministic reveal was Thunder Tempest (drake/storm/thunder-dash/light)                                                                                                                                                                                                                        |
| Browser regression                    | Chromium 154.0.8037.57, real local Vite/Fastify at loopback ports 5201/3201                                          | PASS — dashboard rendered at 1440×900 and 390×844; mobile document width matched 390px and scrolled vertically to 2165px; Twitch setup showed “Not configured” and retained simulation. OBS rendered at 1920×1080 and 1280×720. Arena mounted one Phaser canvas and accepted ArrowRight input. No browser console/page errors or failed requests were observed |
| Diff whitespace                       | `git diff --check`                                                                                                   | PASS                                                                                                                                                                                                                                                                                                                                                           |

Actual Chromium captures (not edited or generated): [dashboard 1440×900](visual-qa/p3b/p3b-dashboard-1440x900.png), [dashboard 390×844](visual-qa/p3b/p3b-dashboard-390x844.png), [OBS 1920×1080](visual-qa/p3b/p3b-overlay-1920x1080.png), [OBS 1280×720](visual-qa/p3b/p3b-overlay-1280x720.png), and [arena in progress 1440×900](visual-qa/p3b/p3b-arena-in-progress-1440x900.png).

### Not tested and remaining limitations

- Real Twitch OAuth consent, access/refresh token validation against Twitch, Helix subscription, live EventSub messages and channel voting are **NOT TESTED**. No credentials were available to this process and no Twitch endpoint was contacted. Fake transports and fake HTTP responses do not prove production connectivity.
- The cloud environment draft now declares `TWITCH_CLIENT_ID`, `TWITCH_INTEGRATION_ENABLED=false`, a user-provided `TWITCH_CLIENT_SECRET` requirement, and `id.twitch.tv`, `api.twitch.tv`, and `eventsub.wss.twitch.tv` egress. The draft is saved but not applied. Owner must review/publish it, privately configure credentials, verify the exact callback in Twitch Console, and initiate OAuth in the local browser.
- The exact OAuth callback on port 3001 was not exercised. Ports 5173 and 3013 were occupied by unknown processes and left untouched; this QA used 5201/3201. No claim is made about callback behavior through an actual Twitch consent cycle.
- The Phaser arena remains local client-side combat and the large lazy Phaser chunk advisory remains.
- Keep Draft PR #5 open and unmerged. Independent exact-head security review is pending; Codex-run tests are not approval.

## P3-B-C2 — bounded remediation of independent C1 findings

This remediation stays on `feat/phase3b-live-twitch-integration` and the
existing Draft PR #5. It fixes the four C1 findings without enabling the
integration or changing the product scope.

| Finding                          | Remediation and regression evidence                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1-01 — mode transition ordering | Forge replacement transitions advance `serverStartedAt` monotonically and rotate `serverInstanceId`; mock→Twitch connecting and Twitch→mock logout snapshots are published immediately. A server integration test applies those snapshots through the real `ForgeStateReconciler` and proves delayed prior-mode snapshots are rejected. The existing backend restart/revision-zero C5 regression still passes. |
| C1-02 — stale socket disconnect  | Each WSS transport owns an idempotent close/error handler. Replacement welcome transfers ownership before the old socket closes; stale close/error events are ignored. A fake-socket regression verifies the replacement remains connected and forwards validated chat.                                                                                                                                        |
| C1-03 — stale Helix verification | Subscription attempts hold a welcome-session generation lease and check it after each asynchronous token, POST, GET, and JSON step. Fake deferred fetch regressions cover stale success, 409 verification, and request error outcomes after a newer session welcomes.                                                                                                                                          |
| C1-04 — logout fallback          | Authenticated logout shuts down Twitch, clears the owner cookie, creates and publishes a fresh mock forge, and lets the default local simulation endpoints work without a Twitch cookie. An integration regression exercises logout, stale snapshot rejection, and a new synthetic forge start.                                                                                                                |

### C2 verification results

| Criterion                        | Actual result                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen workspace install         | PASS — `pnpm install --frozen-lockfile` completed with pnpm 11.25.0; lockfile resolution was skipped. The documented `/workspace` store path is unavailable on this host, so pnpm's standard user cache was used.                                                                                                                |
| Build                            | PASS — `pnpm build`; shared, server and web compiled. Vite retains the existing lazy Phaser chunk size advisory (~1.22 MB raw / 337 KB gzip).                                                                                                                                                                                    |
| Typecheck and lint               | PASS — `pnpm typecheck`; `pnpm lint`.                                                                                                                                                                                                                                                                                            |
| Format                           | PASS — repository-wide `pnpm format:check` (run after the final doc edits).                                                                                                                                                                                                                                                      |
| Full tests                       | PASS — 110 total (23 shared, 87 server), preserving all 106 tests from C1. New tests cover reconnect close/error handoff and delayed Helix success/409/error completions, plus transition ordering and logout fallback.                                                                                                          |
| Mock simulation                  | PASS — `BOSSFORGE_VOTE_SECONDS=5 pnpm simulate` completed all four categories with two synthetic votes each and revealed Thunder Tempest (drake/storm/thunder-dash/light).                                                                                                                                                       |
| Chromium dashboard / OBS / arena | PASS — local dashboard Start and Generate event controls worked and reflected the completed synthetic forge; OBS rendered the revealed state; arena mounted one Phaser canvas. All three stayed within the observed 1512px browser width. No application console errors were observed; browser extension warnings are unrelated. |
| OAuth local preflight            | PASS — local `/auth/twitch` returned 503 with `Twitch integration is not configured`; the localhost callback without OAuth parameters returned the expected 400. Both used synthetic credential environment values and `TWITCH_INTEGRATION_ENABLED=false`; no Twitch request or consent occurred.                                |
| Diff check                       | PASS — `git diff --check` (run after final edits).                                                                                                                                                                                                                                                                               |

The focused integration tests use synthetic OAuth strings, fake HTTP responses,
deferred fake fetches, and fake WebSocket transports. No real Twitch account,
secret, OAuth consent, Helix request, EventSub connection, public endpoint, or
production deployment was used. The feature remains disabled by default.
Independent exact-head P3-B-C2 review is requested on Draft PR #5; no merge or
activation is authorized.
