# Phase 0 acceptance

Status vocabulary: **PASS** ran successfully; **FAIL** ran and failed;
**NOT TESTED** was not run or could not be observed. Update this matrix with
actual outcomes; do not infer a pass from a configured script.

## Required checks

| Criterion                                        | Verification                                                        | Result                                  |
| ------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------- |
| pnpm workspace and frozen dependency install     | `pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store` | PASS                                    |
| Production web and server builds                 | `pnpm build`                                                        | PASS                                    |
| TypeScript checks                                | `pnpm typecheck`                                                    | PASS                                    |
| ESLint checks                                    | `pnpm lint`                                                         | PASS                                    |
| Unit/integration suite                           | `pnpm test`                                                         | PASS — 16 tests                         |
| Server health response                           | `GET /health`                                                       | PASS — direct and through Vite proxy    |
| WebSocket delivers mock events                   | Server integration test; `pnpm simulate`                            | PASS — 4 synthetic events               |
| Dashboard and overlay routes serve the app shell | HTTP requests to `/` and `/overlay`                                 | PASS                                    |
| Dashboard and overlay browser rendering          | Chromium headless smoke check                                       | NOT TESTED                              |
| Secret review                                    | Credential-pattern scan of project files                            | PASS — no matches                       |
| Patch whitespace                                 | `git diff --check`                                                  | PASS                                    |
| Feature branch commit and push                   | Commit `94506e09205f9aff27a5da29f8bdde9a90f6dc4c` on origin         | PASS                                    |
| Draft PR                                         | `gh pr create --draft --base main`                                  | BLOCKED — GitHub API returned Forbidden |

## Visual QA

The container has a Chromium binary, but headless capture timed out without a
screenshot, including for a local static `data:` page with a `/tmp` profile and
cache. Browser rendering is therefore **NOT TESTED**. No screenshot is claimed.

## Required test coverage

The suite should exercise shared event schema acceptance and rejection, event
envelope JSON round-trip, deterministic mock event generation and lifecycle,
health success and failure, WebSocket delivery, invalid event rejection,
oversized payload rejection, rate limiting, and connection-state reporting.

Firefox testing is out of scope. Browser automation should use Chromium if
available; otherwise mark browser testing NOT TESTED and report that limitation.
