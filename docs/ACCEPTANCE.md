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

| Criterion                                                                 | Verification                        | Result                                                                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Frozen install, build, typecheck, lint, formatting, complete suite        | Workspace commands                  | PASS — frozen install, build, typecheck, lint, format, and test completed; 44 tests passed (6 shared, 38 server)                     |
| Timed four-stage server-authoritative voting                              | Forge session and integration tests | PASS — injectable scheduler transitions; real simulation completed four 5-second windows                                             |
| Mutable ballot, deterministic tie/fallback, replay/invalid/late rejection | Focused session tests               | PASS — 6 forge tests cover vote changes, ties, fallback, replay, invalid/non-mock/wrong/stale/future/late votes, and timer disposal  |
| HTTP/WebSocket snapshots, two-client updates and reconnect                | Server integration tests            | PASS — two clients receive versioned state and reconnect reads the current snapshot                                                  |
| Local-only simulation and retained Phase 0 security                       | Existing plus targeted route tests  | PASS — remote/foreign-origin mutations rejected; local dashboard and originless CLI accepted; production routes absent               |
| Repeatable end-to-end synthetic forge cycle                               | `pnpm simulate`                     | PASS — multiple cycles completed; deterministic `Thunder Tempest` reveal after reset                                                 |
| Desktop/mobile dashboard and two OBS sizes                                | Chromium visual QA and screenshots  | PASS — real captures and viewport checks at all four required sizes                                                                  |
| Independent review                                                        | C4 review handoff on Draft PR #2    | CHANGES REQUESTED — C4 comment 6415746841 identified restart epoch and stale HTTP response races; C5 remediation below awaits review |

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
| Independent C5 review                                          | Existing Draft PR #2                              | PENDING — review the exact pushed HEAD in the C5 handoff; no independent approval claimed                                                   |

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
