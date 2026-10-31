# D0 — Desktop Architecture, Security, and Packaging Decision Record

**Project:** BossForge Live  
**Phase:** D0 — docs-only product-direction/specification  
**Baseline:** `main@bc69306125b85aade4e283e69b0742e6f838aee1` (2026-10-31)  
**Status:** Proposed; independent exact-head review required; **no implementation authorization implied**  
**Delivery target:** Draft PR, no merge/deploy/release or real Twitch calls

## 1. Outcome and boundary

Specify a security-reviewed path from the current local React/Vite + Fastify hackathon development app to downloadable **macOS and Windows** desktop applications while retaining a **read-only OBS Browser Source**, an explicit credential-free mock path, and server-authoritative Twitch chat votes/combat.

D0 changes **documentation only**. It does not add Electron, installers, secrets, Twitch clients, network listeners, signing credentials, dependencies, telemetry, live services, or automatic updates. The submitted hackathon build remains untouched.

### Evidence and source-of-truth inventory at this baseline

- `apps/server/src/index.ts` boots Fastify at `127.0.0.1:3001` by default.
- `apps/web/vite.config.ts` serves Vite on loopback and proxies `/api`, `/events`, and `/health` in development.
- `apps/server/src/twitch/oauth.ts` uses the **confidential authorization-code flow** and requires a `clientSecret`, exact `http://localhost:3001/auth/twitch/callback`, and process-memory token/session maps.
- `apps/server/src/app.ts` enables local Twitch auth, dashboard/event feeds, and simulation/owner routes under **development-mode** guards. A packaged `NODE_ENV=production` app cannot simply assume these features will remain available; do **not** bypass development-mode guards to make a build work.
- `apps/server/src/security/local-access.ts` restricts loopback peers and Vite development Origins; it is not production desktop authentication.
- `docs/SECURITY.md`, `docs/M2-D-LIVE-TWITCH-OBS-ACCEPTANCE.md`, and `README.md` distinguish synthetic evidence, owner-reported Twitch/OBS results, and remaining native-OBS/battle gates.

**Explicit verification gap:** these are repository/source findings and official API documentation, not proof that a desktop runtime, Windows build, or public Twitch-client configuration works.

## 2. Proposed decisions for independent review

| ID | Proposal | D0 disposition |
| --- | --- | --- |
| D0-01 | Electron main process + packaged React dashboard, shared/server business logic retained. Electron Forge for candidate installers. | Proposed; compare Tauri only if size/resource evidence outweighs Node reuse. |
| D0-02 | Mock-only **first** on both platforms, with Twitch fully disabled by construction. | Proposed hard gate for D1. |
| D0-03 | Desktop Twitch uses a **new, separately registered Twitch Public client** and Device Code Grant Flow; do not package the confidential client secret or reuse its desktop authorization-code handler. | Proposed; validate Twitch developer-console registration, scopes, polling and refresh on a test app first. |
| D0-04 | Keep the OBS overlay as a local, read-only HTTP/WebSocket projection, separated from privileged streamer controls. | Proposed; threat model and origin/authorization proof mandatory. |
| D0-05 | Store refresh credentials using vetted OS-protected storage (macOS Keychain; Windows credential/DPAPI-backed facility); access tokens memory-first; never give renderer/OBS raw tokens. | Proposed; storage API/ACL choice is a D2 proof point. |
| D0-06 | No automatic public release, update system, telemetry, or remote management in D1–D3. | Proposed; any later scope requires its own review. |
| D0-07 | macOS Developer ID signing + notarization and trusted Windows signing are D4 public-distribution gates, not mock-build prerequisites. | Proposed; unsigned installers are labeled private/internal testing only. |

No proposal here constitutes permission to merge, build a production installer, create Twitch apps, access credentials, authorize a real Twitch channel, or ship software.

## 3. Target runtime and process model

```text
                     Streamer's device
+---------------------------------------------------------------+
| Electron main process                                        |
| - app lifecycle; creates sandboxed dashboard renderer        |
| - launches/supervises packaged local backend                 |
| - owns privileged auth and OS-vault adapter (D2 only)        |
| - narrow validated IPC bridge, never arbitrary Node access  |
|          |                                     |              |
|          v                                     v              |
| React dashboard                          Local backend       |
| packaged static assets                   Fastify + shared    |
| (no Vite dev server)                     forge/battle engine |
|          |                                     |              |
|          +-- authorized owner controls -------+              |
|                                                |              |
| OBS Browser Source --> 127.0.0.1:<local-port> -+              |
|                   read-only /overlay + narrow WS              |
+---------------------------------------------------------------+
                         |
               D2 only: Twitch HTTPS/WSS
               Device Code / Helix / EventSub
```

**Implementation choices to prove in D1, not assume:**

1. Electron main owns server startup and graceful shutdown. Avoid orphaned processes; only stop a child PID the app created. Do not spawn a full dev watcher, run `pnpm dev`, bundle `.env`, or depend on an installed system Node.js.
2. Build local static React assets into the package. Replace the Vite development proxy with an explicit packaged routing plan and versioned safe contracts. Desktop production must not expose the old development simulation or debug endpoints.
3. Prefer a stable per-installation loopback overlay URL for OBS (with a strictly checked reserved port/configuration) **or** demonstrate a safe discovery/reconfiguration UX. Never silently bind to `0.0.0.0`, choose a random external host, or terminate an unknown process occupying a port.
4. Clearly separate an **unprivileged presentation surface** (OBS) from an authenticated desktop **owner-control surface**. Rendering the overlay must not grant access to session cookies, privileged IPC, Twitch tokens, event diagnostics, or mutating endpoints.
5. Desktop runtime mode is a new explicit deployment context, **not** `developmentMode=true` in production clothes. Preserve source and battle authority, model versions, replay/cooldown checks, and fail-closed disconnect/cancellation semantics.
6. If a renderer or local server crashes, fail closed, show a useful operator state, invalidate stale authority, and do not automatically resume a battle or reconnect to Twitch without approved lifecycle policy. Exit cleans up background resources.

## 4. Threat model and non-negotiable security properties

| Boundary / threat | Control / evidence required |
| --- | --- |
| Untrusted Twitch chat or EventSub frames | Preserve strict normalized schemas, provenance, bounded buffers, replay checks, source identity, cooldown and server-only damage authority. No execution of chat commands as code. |
| Remote web page attacking loopback backend via CSRF/DNS rebinding | Validate effective Host, remote socket peer, exact Origin/Fetch Metadata where applicable; owner actions require separate unguessable desktop authorization plus CSRF/session protection. Loopback alone is **not** authorization. |
| OBS Browser Source being treated as an admin renderer | Overlay routes are strictly GET/read-only; versioned allowlisted DTOs contain no viewer identifiers or private auth/session material; restrict WS and HTTP to safe loopback access; prevent capability escalation and unsafe redirects. |
| Electron renderer compromise | `nodeIntegration: false`, `contextIsolation: true`, renderer sandbox enabled, restrictive CSP, navigation/new-window controls, permissions denied by default, allowlisted validated IPC, no arbitrary shell/file access. |
| Installer extraction / app reverse engineering | Assume all packaged JS, binaries, and config can be inspected. No `TWITCH_CLIENT_SECRET`, access/refresh tokens, signing private keys, or non-public credentials in artifacts. |
| Credential storage/recovery | OS-protected persistence for *rotating* refresh token, least-privilege ACL, keychain lock and logout behavior; no token in plaintext settings, logs, crash reports, renderer state, or OBS. Test denied vault access, lock/unlock, migration and deletion. |
| Stale/expired or revoked Twitch authorization | Verify Client ID, numeric identity, scopes and token freshness; single-flight refresh, **atomically persist replacement refresh token**, secure invalidation on failure, explicit reauth UX. EventSub suspends immediately on invalidation. |
| Malicious dependency / update channel | Pin lockfiles and Electron/Forge versions, scan production transitive dependencies, require immutable signed artifacts, no live remote code or silent auto-update. |
| Cross-install or multi-instance collision | Single-instance policy, loopback port ownership checks, no owner/session token reuse across concurrent instances; explicit safe error, no killing unrelated processes. |
| Local privacy and logging | No raw viewer chat, stable Twitch IDs, usernames, message IDs, OAuth codes, tokens, cookies, or private diagnoses in logs, overlay, screenshots, or public PRs. Fixed-category redacted diagnostics only. |

**Public release must not rely on the existing local-development browser Origin allowlist, cookie names, or `NODE_ENV=development` route guards as sufficient desktop security.**

## 5. Twitch desktop authorization design (D2, not D0 execution)

- Twitch **Public client + Device Code Grant Flow (DCF)** is the candidate because a distributed desktop application cannot keep a confidential client secret. Obtain a separately registered client ID with the correct Public client type; do not modify or disable the existing confidential hackathon Twitch app until the new path is verified.
- The streamer explicitly chooses **Connect Twitch**. Backend initiates device authorization with minimal `user:read:chat` scope, displays Twitch's verification URL/code, polls server-side within the returned interval/expiry, handles pending, slow-down, denied, expired and network failure without displaying tokens. Never poll or connect merely because a Client ID is present.
- On token receipt, validate against Twitch's validation endpoint: expected client ID, `user:read:chat`, and numeric user ID. For initial MVP use the broadcaster's own account as both broadcaster and reader, as the current P3-B contract does. EventSub `channel.chat.message` v1 uses an authenticated **user** access token and verified websocket welcome/subscription.
- Assume **public-client refresh tokens can expire within 30 days**, even if newer guidance describes inactivity/rotation differently. Refresh tokens may be one-use and rotated. Maintain a single-flight lock; save new refresh token transactionally/atomically before discarding old; validate rehydrated identity on restart; revoke/logout and wipe vault entries on user disconnect; fail closed and prompt reauthorization on expiration/revocation. Do not promise permanent login.
- Split backend token/service authority from display clients. Never pass provider tokens, auth codes, polling secrets, or HTTP request headers into a renderer, overlay, IPC event, URL fragment, WebSocket event or log. A desktop owner session must **not** be inferred from the fact that OBS loaded successfully.
- D2 must include a privately run real-device proof using a dedicated test Twitch app/account, with explicit operator approval and credential-safe evidence. Mock tests alone cannot sign off on actual Twitch grant support.
- Keep outbound HTTPS to identity/Helix and WSS to Twitch; validate redirect and reconnect destinations according to Twitch's protocol. Do not silently fall back from live to mock mid-encounter.

Official references (revalidate when implementing):
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth
- https://dev.twitch.tv/docs/authentication/refresh-tokens/
- https://dev.twitch.tv/docs/authentication/validate-tokens
- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

## 6. Desktop packaging and distribution

**D1 private mock builds:** package Electron main/preload, production-built React assets, backend code, runtime dependencies, and four SVG bosses; do not package `.env` or external credentials. Support launching/installing/uninstalling on clean macOS and Windows machines; no Node/pnpm dependency on the user's host. Display `SIMULATED` unambiguously. Verify OBS Browser Source, viewport fit, loopback-only listener, multiple-instance behavior, app shutdown/relaunch, offline operation and failure modes. Clearly label mock installers as testing artifacts and avoid claims of signing/notarization.

**D3 Twitch candidate builds:** only after separate D2 security review approval; confirm device flow, scopes, refresh, EventSub, live `!vote` and `!hit`, read-only OBS HP synchronization and disconnect behavior on both OSes. Preserve existing M2-D incomplete acceptance items; desktop validation cannot inherit a PASS from browser/mock tests.

**D4 public distribution (separately authorized):** macOS Developer ID sign all applicable bundles and notarize/staple a DMG or PKG; Windows produce a conventional installer, sign with a trusted publisher certificate where available, verify SmartScreen behavior without promising zero warnings. Freeze supported OS versions and package identifiers only after validation. No automatic updates or installer publication without explicit approval.

Candidate tools: Electron + Electron Forge, with Forge DMG and Windows Squirrel/alternative maker assessed against application lifecycle and current maintenance support. Forge's Vite plugin carries an experimental maturity warning; validate the production bundling path and pin versions rather than presuming it is production-safe. Native compilation/rebuild, Windows packaging on a supported runner, architecture-specific macOS signatures, and supply-chain verification belong to D1/D4 evidence.

References:
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronforge.io/config/plugins/vite
- https://www.electronforge.io/config/makers/dmg
- https://www.electronforge.io/config/makers/squirrel.windows
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation

## 7. Acceptance matrix and phase authorization gates

### D0 — docs-only acceptance

- [ ] Independent reviewer verifies this document against exact `main` code and current official Twitch/Electron requirements.
- [ ] Review explicitly resolves **D0-01..07**, including owner-control/OBS isolation and public-client feasibility.
- [ ] Changes are only docs and linked status/roadmap; no code, config secrets, dependency changes or runtime/network effects.
- [ ] PR stays **Draft**, unmerged, until an explicit separate owner decision.

### D1 — mock-only build (requires new owner authorization)

- [ ] Clean install, launch, show `SIMULATED`, complete four-stage forge and battle on **both** platforms.
- [ ] Real Twitch network and credentials provably **disabled**; no token or secret string inside artifacts or source maps.
- [ ] OBS Browser Source receives fresh bounded read-only projections and shows battle HP/cancellation; HTTP/WS negative tests prove no privileged control or unsafe cross-origin access.
- [ ] Clean startup/restart/quit/uninstall; locked ports, zombie process and parallel-instance handling verified.
- [ ] Offline package works without developer tooling; restore path after backend/renderer crash verified.
- [ ] Automated targeted tests, dependency scan, static packaging inspection, and native QA screenshots/video recorded separately per OS.

### D2 — desktop Twitch auth (separate owner approval)

- [ ] Public client/DCF compatibility validated against Twitch **without** embedded secret.
- [ ] Authorization-pending, denial, slow-down, expiry and cancellation proven; identity/scope validation, rotating refresh, vault persistence, logout/revocation and restart tested.
- [ ] Negative tests for stale tokens, invalid identity, failed vault write, missing scope, CSRF, Origin, renderer IPC and no silent mock fallback.
- [ ] Independent security review of full end-to-end data/control flow at exact PR HEAD.

### D3 — Twitch-enabled cross-platform QA (separate owner approval)

- [ ] Genuine Twitch EventSub verified and `!vote`/weakness/`!hit` recorded with operator consent on macOS **and** Windows.
- [ ] Native OBS HP/timer/outcome synchronization, read-only permissions, 1920x1080 and 1280x720 sizing verified.
- [ ] BossForge-side 2-second cooldown, base 8 / weakness 14 damage, expiry, victory, restart and disconnect-cancel proven with genuine authorized events.
- [ ] No credentials or identifying chat data present in public evidence.

### D4 — signed public launch (explicit separate release authorization)

- [ ] Apple Developer ID signing, notarization and gatekeeper checks on real Mac.
- [ ] Windows trusted publisher signing and supported clean-install/update/uninstall acceptance; SmartScreen warnings documented truthfully.
- [ ] Software bill of materials/dependency review, reproducible release provenance, final security review, privacy statement, support/update policy and rollback.
- [ ] Explicit owner authorization for publication. **Never auto-merge, publish or deploy.**

## 8. Open questions and non-goals

**To resolve during D0 review:** exact packaged backend lifecycle (child process vs supervised Electron utility process); stable OBS port and how it is advertised; whether the dashboard should use a protected loopback origin or a custom protocol with narrowly scoped owner IPC; selected cross-OS credential API and safe migration; permitted multi-instance UX; Windows signing and build-runner availability; minimum supported OS versions and architecture.

**Non-goals for D0–D3:** Twitch chat posting/moderation, cloud backend, accounts/subscriptions, game hooks/input injection, remote administration, cross-machine OBS control, analytics/telemetry, background auto-updates, app store submission or changes to the optional Phaser Arena.

## 9. Next authorized action

After an **independent exact-head D0 review** and owner decisions on D0-01..07, request separate approval for **D1: mock-only desktop shell implementation** on a fresh bounded branch/PR. Do not promote D0 docs approval into permission to make a Twitch-enabled installer.
