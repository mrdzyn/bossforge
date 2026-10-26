# P2 — Playable Boss Battle

**Project:** BossForge Live  
**Authorized phase:** Phase 2 — local simulated boss combat only  
**Approved baseline:** `main` at `2ca5c1ebcd0fe4f51b153faf36a8a765d66fec45` (Phase 1 squash merge, PR #2)  
**Working branch:** `feat/phase2-playable-boss-battle`  
**Delivery:** Existing/new Draft Phase 2 PR, exact-head independent review, explicit owner merge decision  
**Blocker:** Twitch developer 2FA/mobile verification remains unresolved; real Twitch integration is excluded.

## Goal and minimum compelling demo

Build one complete playable **streamer versus audience-created boss** round in the browser:

1. Streamer starts the existing mock-only forge.
2. Four timed voting stages produce the authoritative immutable boss from Phase 1.
3. On reveal, streamer chooses **Enter arena**; arena receives the validated boss snapshot, never invents attributes.
4. Streamer moves, dodges telegraphed boss attacks, aims/fires, and exploits the announced weakness.
5. Boss and player health update; a complete **streamer wins** or **community wins** ending occurs.
6. Streamer can rematch the same boss locally, or return to the dashboard to forge another boss, without a full server restart.

Prioritize a reliable 30–90 second human-playable loop over extra modes or visual effects. A synthetic audience is always conspicuously labeled, never misrepresented as Twitch.

## Technology and boundaries

- Keep the pnpm TypeScript monorepo, React/Vite frontend, Fastify server, `packages/shared` Zod contracts, existing `ForgeSession` and `ForgeStateReconciler`.
- Integrate **Phaser 3** (prefer stable `phaser@3.90.0`, verify lockfile and compatibility). Avoid accidentally moving to Phaser 4 or introducing a second game engine. Use dynamic import/lazy route to keep non-arena dashboard/OBS payloads lean.
- Implement the Phaser scene as a **client-side local demo**. Phaser handles render/input/collisions; pure deterministic TypeScript gameplay/reducer helpers own attack scheduling, damage, health, phase transitions, invulnerability and final outcome, so rules can be unit-tested without canvas.
- **Phase 1 server remains authoritative for forge/boss selection.** Phase 2 combat is explicitly **local client-side simulation**; do not claim production-grade battle authorization, networked multiplayer or server-authoritative combat.
- Avoid any new unauthenticated remote/public mutations, player telemetry, persistence, payment/auth tokens, arbitrary command execution or user-generated script content.
- Retain existing Vite loopback-host, server socket-peer/Origin/Fetch Metadata, WebSocket restrictions, rate limit and mock-provider guards. No changes to production route exposure.
- All Phaser graphics/assets should be original procedural shapes, lightweight local assets or already licensed project art, never copied characters or remote runtime dependencies.

## Game contracts and lifecycle

1. Prefer `/arena` as the dedicated React route; retain `/` dashboard and `/overlay` unchanged unless a minimal navigation link is needed. Match existing navigation style.
2. Use only a **validated revealed `ForgeState`** with a non-null `Boss` from the local server snapshot. If no revealed boss exists, display a clear disabled/return-to-forge state, never silently construct a fake production boss.
3. Bind the arena to `serverInstanceId`, `cycleId`, and boss attributes. If the server restarts, resets, or the forge changes during play, stop or invalidate the old combat run and offer a safe path back to the forge. Do not let stale HTTP/socket callbacks restore an old battle.
4. Phaser must mount once per arena lifecycle, destroy game/scene/listeners/timers on unmount, route transition or restart, and not leak requestAnimationFrame/audio/keyboard listeners. React StrictMode double-mount and browser visibility pause/resume must not create duplicate games or damage ticks.
5. State transitions: `ready -> active -> streamer-won | community-won`, optionally `paused`. Terminal results are immutable until explicit rematch/restart; never apply damage or attacks after terminal state.
6. No battle input is accepted over public WebSockets. If adding developer-only APIs for future OBS needs, explicitly security-review and apply the existing local-only protections rather than bypassing them. A game-view/window-capture OBS demo is acceptable for P2; fully synchronized remote OBS combat presentation belongs to P4.

## Minimum combat mechanics

- **Arena:** readable top-down 2D arena with player, boss, health bars, aim/attack feedback, telegraphs, hit feedback, short control legend and end-of-round banner.
- **Player:** finite 100 HP; move with WASD/arrows; aim with pointer; fire on pointer click or Space with cooldown; dodge/short dash with Shift and finite cooldown. A simple accessible desktop first experience is required. Mobile viewport must not horizontally overflow; touch combat controls may be deferred, clearly documented rather than falsely claiming support.
- **Boss:** reuse deterministic `Boss.stats` from Phase 1 for max health, base damage and attack cadence. Preserve name, body, element, special and weakness in battle HUD. Body shapes and element palette must be visibly distinct.
- **Attack patterns:** one clear, telegraphed, avoidable behavior for **each** existing special:
  - `ember-burst`: radial burst projectiles, with an indicated safe gap.
  - `frost-chain`: staggered aimed shots; optional short bounded slow on hit.
  - `thunder-dash`: wind-up line then charge.
  - `shadow-pulse`: expanding area pulse with a visible dodge interval.
  Patterns should be mechanically distinguishable, not merely different labels or colors. All attacks must have bounded damage and reasonable avoidance windows.
- **Weakness:** an actionable player choice. Example: 1/2/3/4 select water/light/earth/wind ammunition, with a visible damage multiplier only when it matches the boss's announced weakness. Cap multiplier, show feedback, and avoid a single-hit instant kill. UI must explain mapping.
- **Element:** distinct attack telegraphs/effects/palette for fire, ice, storm and void; do not require four complex separate engines. If element-specific mechanics are simplified, document exact effects. Keep meaningful gameplay variation from special and weakness.
- **Outcome:** victory triggers at boss HP 0, defeat at player HP 0; simultaneous lethal damage resolved by a documented deterministic rule. Freeze input after result, provide same-boss rematch and fresh-forge navigation.
- **Balance:** bounded configuration constants, attack/collision immunity windows, no unfair instant or invisible damage, fixed or seeded deterministic attack schedules for repeatable testing. Never derive projectile physics from arbitrary untrusted chat strings.

## Implementation slices (within this one phase)

**P2-A — Integration and vertical slice:** Phaser installation, lazy arena route, mount/unmount lifecycle, pass revealed boss snapshot through validated contract, accessible start/return UI, movement, aiming/firing, basic player/boss health and first working victory/defeat.

**P2-B — Audience boss differentiation:** the four special patterns, visual body/element traits, actionable weakness selection, dodge/cooldowns, damage telegraphs, victory/defeat/rematch, restart/cycle invalidation.

**P2-C — QA/hardening:** pure combat tests, integration/route smoke, no input/timer leaks, Chromium playable run, screenshots, replayable demo runbook, documentation. Complete slices sequentially on the same branch/PR; avoid broad refactors.

## Tests and acceptance

Automated evidence should include:

- Valid revealed snapshot can enter arena; idle/voting/null/invalid boss cannot.
- Damage never becomes negative; cooldown/rate limits and invulnerability windows; no damage after terminal result; victory and defeat (including simultaneous-lethal precedence).
- Each of the four specials has deterministic attack scheduling and measurable hazard behavior; player movement, collision, dodge and damage are coherent.
- All four weakness choices, matching and nonmatching damage, with exact bounded multiplier; boss attributes and stats taken from Phase 1 state unchanged.
- Rematch resets combat but retains the same boss; new forge/restart invalidates stale combat and cannot revive an old boss.
- Mount/unmount, StrictMode/re-render, focus/visibility pause and restart do not duplicate handlers, timers, projectiles or Phaser instances.
- Existing **49 Phase 1 shared/server tests** and all local-only security regressions remain green.

Run frozen install, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `git diff --check`. Add appropriate focused web/combat tests.

**Chromium acceptance:** Verify actual game play and screenshots at desktop 1440×900 (or 1920×1080), dashboard 390×844 for regressions and no horizontal overflow, plus OBS at 1920×1080 and 1280×720. Capture separate start, combat telegraph, win, loss and rematch states. Record controls tested, boss variation examples, console/network errors, and performance observations (actual results only). If browser unavailable, mark **NOT TESTED**. A screenshot without exercised input does not prove playability.

## Demo runbook / product integrity

Provide local start/install instructions and a **repeatable full round** covering synthetic voting -> boss reveal -> combat -> one legitimate result -> rematch. Keep the `SIMULATED / NOT CONNECTED TO TWITCH` disclosure visible and obvious for hackathon evidence. Do not describe mock votes as live Twitch. Do not require a Twitch account, external API keys, paid services or deployment for P2 QA.

## Delivery and audit gates

- Preserve original Phase 0 and Phase 1 acceptance history.
- Update `docs/STATUS.md`, `docs/HANDOFFS.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE.md`, `docs/ROADMAP.md`, `README.md` only as relevant to actual implementation.
- Commit and push to **`feat/phase2-playable-boss-battle`**, update its **existing Draft PR**; record exact HEAD and actual validation.
- Seek independent review of the **exact pushed HEAD** for gameplay, quality, safety, cleanup and evidence. Tests authored by Codex are not independent audit approval.
- No merge, squash, deployment, release, publishing, Twitch OAuth/EventSub, public combat endpoints, multiplayer or Phase 3 work without separate owner approval.
