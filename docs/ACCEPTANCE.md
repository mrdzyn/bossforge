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
