# P1 — Audience Voting and Modular Boss Assembly

**Project:** BossForge Live
**Repository:** mrdzyn/bossforge
**Authorized phase:** Phase 1 only
**Base main:** `1fc0d8b8f8d3665266a4a5092f6da240bbddf7b1` (squash merge of PR #1; Phase 0)
**Feature branch:** `feat/phase1-voting-boss-assembly`
**State:** Implementation authorized; kickoff specification only (not yet implemented or tested)
**External blocker:** Twitch account 2FA / developer application registration. Real Twitch OAuth/EventSub is out of scope.

## Goal
Deliver one fully demonstrable, **local-simulation-only** forge cycle: four timed audience votes build a deterministic boss; both the streamer dashboard and OBS preview update through authoritative server state. No battle/combat, real Twitch connection, deployment, or production hosting.

## Product workflow
1. Streamer initiates a local forge cycle in the development dashboard.
2. Server opens sequential voting windows for `body`, `element`, `special`, then `weakness`.
3. Synthetic viewers vote via valid normalized mock `chat.message` events with `!vote <category> <choice>`; only the open category accepts votes. One effective vote per stable `viewer.id` per category; change replaces old choice, never double-counts. Display name is not identity.
4. Both browser surfaces display countdown (server-authoritative closesAt), eligible options, live counts, percentages, and current selection. Close is decided server-side, not by client clock.
5. Each category finalizes with deterministic tie-break (declared option order) and deterministic no-vote fallback (first listed option). Mark no-vote fallback transparently in results. Late and replayed messages cannot alter a finalized category.
6. Once all four categories close, build one immutable boss from the winning attributes and show a conspicuous **SIMULATED / NOT CONNECTED TO TWITCH** label. Streamer may reset and begin another round locally.

## Canonical options
Keep existing `BossAttributesSchema` types in `packages/shared`; avoid changing user-facing slugs without versioned migration.
- body: `golem`, `wraith`, `drake`, `mimic`
- element: `fire`, `ice`, `storm`, `void`
- special: `ember-burst`, `frost-chain`, `thunder-dash`, `shadow-pulse`
- weakness: `water`, `light`, `earth`, `wind`

Use default 15 seconds per category with an injectable clock and testable timer/scheduler; optional bounded duration 5–60 seconds only if implementation is straightforward. Avoid timer handles leaked during reset/close. No real-world randomness for tie-breaking or boss stats. Use a deterministic boss-name and bounded-stats mapping based solely on selected attributes (plus explicit cycle ID if needed); document the algorithm and examples.

## Architecture and event contracts
- `packages/shared`: Zod schemas/types for vote states, vote results, forge state, boss reveal, and versioned WebSocket event payloads. All events remain strictly validated and bounded.
- `apps/server`: an authoritative in-memory `ForgeSession` state machine with explicit transitions (`idle`, `voting`, `revealed`), injected clock/scheduler, normalized mock chat as input, replay/late-vote rules, and stable vote counts. Wire new events through existing `EventHub` without changing the transport's security posture.
- Provide `GET /api/forge/state` or equivalent read-only local snapshot for refresh/reconnect. Development-only streamer mutations (start, advance if needed for test, reset) MUST reuse the existing loopback-socket, Origin/Fetch-Metadata, simulation mode and rate limiting protections. Do not expose remote or production admin actions.
- Event source must be `mock` in Phase 1. No Twitch provider spoofing. Do not send synthetic votes through Twitch.
- Clear bounded state and deterministic behavior on restart: in-memory state resets; no persistence is claimed. Snapshot and live events must stay consistent across multiple browser subscribers.

## Visual requirements
- Preserve existing BossForge Live dark neon visual identity and readable layout.
- Dashboard: running category, countdown, voter totals, option counts/bars, progress 1/4–4/4, start/reset local controls, completed attribute chips and assembled boss preview. Keep event feed.
- OBS overlay: read-only vote presentation and reveal, safe at 1920×1080 and 1280×720; no admin controls, secrets, or technical/debug artifacts. Clearly mark as local simulation.
- Modular boss illustration visibly varies with body, element, special, and weakness. Use original CSS/SVG components, no external paid generation or copied copyrighted characters. Each trait MUST create an observable change; not merely text.
- Mobile dashboard 390×844: usable vertical scrolling, no horizontal overflow. Keyboard access, legible chart/text, and reduced-motion considerations.

## Required negative behavior
Wrong category, invalid option, malformed vote text, unsupported viewer IDs, inactive/closed voting, duplicate event IDs, stale events, late votes, repeated reset/start, invalid state transitions, and cross-origin admin requests must be rejected or handled deterministically with no unintended state change. Display names and chat text must never be interpreted as executable instructions.

## Tests and verification
Unit tests for state transitions, option eligibility, vote replacement, two viewers, duplicate message IDs, non-vote chat, deterministic tie/no-vote, boundary times, timer disposal/reset, deterministic stats/name, event envelopes, and replay handling. Integration tests for local simulated events -> authoritative vote engine -> websocket -> 2 clients, HTTP snapshot reconciliation after connect/reload, and forbidden remote/foreign-origin mutations. Confirm inherited C1–C4 controls. Test both single-cycle and second-cycle reset.

Run frozen install, build, typecheck, lint, formatting, all tests, and `git diff --check`; report actual commands/outcomes. Chromium visual/interaction smoke for dashboard (1440×900, 390×844) and OBS overlay (1920×1080, 1280×720) with screenshots only if actually captured. Verify a full four-category cycle from simulated viewers through reveal. Mark anything not run as NOT TESTED.

## Delivery and audit
- Work only on the Phase 1 feature branch.
- Update `docs/STATUS.md`, `docs/HANDOFFS.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE.md`, `docs/ROADMAP.md` and `README.md` truthfully.
- Push implementation to existing branch and open or update a **Draft PR** to `main`; never merge/deploy/release/publish without explicit owner approval.
- Report full SHA, change summary, exact test evidence, browser screenshots, feature demo steps, known limitations, and request an **independent exact-head review**. Self-authored checks do not count as independent review.

## Explicitly deferred
Phaser combat, hero control, health/damage mechanics, Twitch OAuth/EventSub and account onboarding, public deployment, external audience access, persistent profiles/databases, payments, AI-generated assets, and complex multiplayer.

## Acceptance gates
1. A complete simulated four-category forge creates a boss with correctly chosen attributes.
2. Counts, snapshots, overlay, and dashboard agree and remain safe under retry/reconnect.
3. Duplicate, invalid, foreign/late votes, and unauthorized mutations do not corrupt state.
4. Each boss trait causes a visible modular appearance difference.
5. Test/visual evidence is explicit and reviewable, and no false claim of Twitch integration is made.
