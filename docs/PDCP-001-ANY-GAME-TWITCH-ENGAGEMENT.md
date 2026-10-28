# PDCP-001 — Any-game Twitch engagement pivot

**Status:** Proposed product-direction specification; planning only. No implementation is authorized by this document or its review.
**Repository:** `mrdzyn/bossforge`
**Planning baseline:** `main` at `5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`, which includes the completed Phase 4-A work from PR #6 and approved-for-planning PDCP-001 merged through PR #7. The independent PDCP-001 exact-head delta audit passed at `adfaa6f5000b330c393a6e50dcc20c7125d1519e` ([PASS review](https://github.com/mrdzyn/bossforge/pull/7#issuecomment-6461839234); [earlier findings](https://github.com/mrdzyn/bossforge/pull/7#issuecomment-6460843038)). The later M0 contract lock is separate documentation and does not authorize M1/M2 implementation.
**Product promise:** **Chat creates the boss. Chat fights the boss. The streamer keeps playing their game.**

## 1. Direction and scope

BossForge Live is primarily a game-agnostic Twitch engagement overlay. The streamer adds a transparent Browser Source to OBS, keeps playing a game of their choice, and lets chat create and fight a community boss through validated chat commands. The overlay presents the encounter; it does not read, control, or inject into the game.

The current four-stage audience forge, verified Twitch OAuth/EventSub integration, mock simulation, React/Vite dashboard, Fastify server, shared schemas, EventHub, and OBS overlay are retained and reused. A new server-authoritative battle session owns encounter HP and accepted damage independently of Phaser. The Phaser arena remains a self-contained optional demo. Its gameplay is not the product's authority, and this pivot does not authorize further Phaser gameplay expansion.

“Any-game” means the overlay can run alongside a game without game-specific integration. It does not mean BossForge detects, reads, automates, or interoperates with arbitrary games. D8 explicitly excludes arbitrary-game telemetry, automatic gameplay detection, multiplayer, user accounts, and cloud hosting.

### In scope

- A verified Twitch or clearly labeled mock four-category forge creates the boss.
- A server-owned encounter presents current boss HP, bounded chat attacks, a disclosed weakness, and a terminal outcome in a read-only OBS overlay.
- Optional, authored streamer challenges can be completed or skipped without interacting with the game or blocking the encounter.
- Strict, data-only JSON profiles begin with `generic` and `arena`.
- Loopback-only operation, Twitch owner authentication, EventSub validation, provider isolation, and explicit human review/merge gates remain mandatory.

### Out of scope

Game process/memory/screen telemetry, automatic gameplay detection, input injection, overlays that read the game, multiplayer, viewer or streamer accounts, persistence/cloud services, payments, arbitrary scripts in profiles, and new Phaser gameplay are excluded. No outbound viewer rewards, chat messages, or automatic Twitch actions are part of this proposal.

## 2. User journey and overlay contract

1. The streamer opens the local dashboard and selects `Generic` (default) or the optional `Arena` profile.
2. The streamer connects Twitch through the existing owner-controlled OAuth flow, or explicitly chooses mock simulation. The dashboard and overlay label the source truthfully.
3. Chat votes through `body`, `element`, `special`, and `weakness`. The overlay shows exact valid commands only for a verified live session; it uses the existing fresh-state requirement and hides stale live prompts after local event-stream loss.
4. The server reveals the assembled boss and enters **battle-ready**. This is not a battle start and no encounter timer runs yet. The overlay shows the revealed boss and ready state. The owner explicitly starts a 60–120 second encounter from the local dashboard; only then does the server set the deadline and publish **active**. During combat, the overlay shows the boss name, profile/theme, HP bar and numeric HP, disclosed weakness and accepted command syntax, timer, aggregate attack count, connection/simulation status, and any current optional challenge.
5. Viewers send `!hit` for a base attack. A proposed weakness form, `!hit <weakness>`, receives the disclosed weakness bonus only when the argument matches the server's active weakness. Invalid or mismatched arguments never receive a bonus; exact acceptance/rejection semantics and user-facing copy are to be locked in M0. The server validates all input and applies damage. The browser never submits damage or changes HP.
6. The encounter ends at zero HP (victory) or the server deadline (escaped/expired). The overlay shows one clear terminal result and a celebration state, then offers no administrative control. The streamer can start another encounter through the mode-appropriate dashboard control defined below.
7. Optional challenges are short, safe, game-independent prompts authored from an allowlist. The streamer may mark one complete or skip it. Challenges never pause voting or the battle timer and never make the overlay imply that a game action was observed.

The overlay remains read-only, transparent-background capable, legible at OBS canvas sizes, and usable when cropped/scaled by OBS. It must display a clear `SIMULATED` disclosure in mock mode, `TWITCH DISCONNECTED`/status-unknown messaging as appropriate, and `SERVER LINK UNAVAILABLE` when authoritative local state is unavailable. It must not continue showing a cached connected state, HP, countdown, or live command prompt as authoritative after feed loss. No Twitch credentials, OAuth data, viewer IDs, or display names appear in the overlay.

### Outbound event privacy boundary

**Current-baseline migration fact:** `NormalizedChatEvent` contains `viewer.id`, `viewer.displayName`, and message text. The current `EventHub` accepts and broadcasts that normalized event to every `/events` WebSocket client, and Dashboard and `/overlay` share that stream. Therefore the current OBS browser receives sensitive chat fields even when React chooses not to render them. This proposal does not change that runtime flow; it must not be described as already sanitized.

Before any milestone claims that viewer identity/chat content is excluded from browser broadcasts—and unconditionally before M2 live battle damage—the implementation must add a server-side boundary:

- Keep raw normalized chat server-internal from EventSub/mock ingress through validation, deduplication, `ForgeSession`/`BossBattleSession` processing, and bounded private cooldown state. Do not call the outbound `EventHub` with `NormalizedChatEvent`, and do not serialize raw chat into a snapshot, log, diagnostic, or error.
- Split internal domain inputs from outbound projections. The outbound hub accepts only strict, allowlisted public schemas. Use recipient-specific routing where necessary: the OBS subscription receives only the minimal `OverlayEventEnvelopeSchema`; the dashboard receives safe state plus a separate aggregate `DashboardActivitySchema`. Neither schema includes viewer IDs, display names, message IDs, raw/parsed chat text, or arbitrary source payloads. `forge.state` vote totals and `battle.state` HP/accepted-hit aggregates are sufficient for the UI.
- Preserve useful dashboard activity without rendering raw messages: show forge stage/vote totals, accepted/rejected aggregate counts with fixed reason codes, battle progress and connection status. Do not preserve an identity-bearing feed. All battle/overlay events are aggregates such as accepted-hit count and HP state, never one event per identified viewer.
- Enforce the boundary on the server before serialization and send. Schema parsing/strictness must reject unknown fields and raw `chat.event` payloads for both dashboard and OBS recipients. A client-side filter or hidden React element is not a privacy control.
- Keep volatile viewer IDs only inside bounded server-side replay/cooldown structures because those controls need stable identity. Do not include those structures or identities in recipient projections. Never log raw EventSub frames, text, IDs, display names, tokens, full errors, or profile-controlled content; diagnostics remain fixed-code counters and aggregate timings.

**Required privacy regressions:** use sentinel viewer IDs, display names, message IDs and chat text, and inspect serialized WebSocket frames for both dashboard and overlay subscribers, HTTP snapshots, diagnostics and captured logs. Assert none of the sentinel values appear through mock, Twitch-shaped, malformed/rejected, disconnect, reconnect or server-restart cases. Assert strict public schemas reject `chat.event` and unexpected identity/text fields, while the internal normalized event still reaches the appropriate forge/battle processor and the dashboard's safe aggregates update. Include fixtures for secrets/tokens and full error objects and assert they never appear. Land this migration in M1 before it claims the no-identity-outbound guarantee; M2 is blocked until the privacy tests and an independent security review pass.

## 3. Proposed contracts and technical architecture

This section describes a proposed implementation boundary; it does not authorize code changes.

### Chat-to-vote and chat-to-battle routing

- Reuse the existing verified Twitch OAuth, `LiveEventSub`, EventSub session validation, subscription verification, `EventSubChatNormalizer`, and normalized event pipeline. Mock traffic remains separately sourced and labeled.
- Route one accepted normalized event to exactly one active domain based on authoritative server phase: the existing `ForgeSession` handles only forge ballots; a new `BossBattleSession` handles only active encounter commands. Do not let the browser choose the route/provider or synthesize Twitch events. Raw normalized events stay inside the server and are not outbound EventHub payloads.
- Keep `ForgeSession` responsible for the four vote stages and deterministic boss reveal. `BossBattleSession` owns encounter start/end, HP, timing, deduplication, cooldowns, damage and terminal result. It starts from a validated immutable reveal/profile snapshot; it is not a Phaser reducer and cannot be mutated by Phaser.
- Keep raw EventSub/mock inputs in an internal processor/router; the outbound EventHub must accept only strict public projections. Separate dashboard and OBS recipient allowlists as described in the privacy boundary above. `OverlayEventEnvelopeSchema` excludes all chat events; `DashboardActivitySchema` exposes aggregates only. Dashboard vote totals, battle progress and connection status remain fully usable without raw messages.
- Do not pass BattleState to the existing `ForgeStateReconciler`, which is typed to ForgeState. Add a battle-specific `BattleStateReconciler` using the same freshness principles but the battle contract: `serverInstanceId`, `serverStartedAt` (epoch), `encounterId`, and monotonically increasing `revision`. Increment revision on every state transition and across encounter changes within an epoch; never reset it for a new encounter.
- Reconciliation is generation-aware. Each WebSocket connection attempt gets a client-local generation; accept frames only from the current generation. HTTP state requests capture that same generation and feed the response through the same battle reconciler. Reject responses/frames from retired generations, lower revisions, old encounter IDs, and conflicting payloads at an equal revision; identical equal-revision snapshots may be treated idempotently. Adopt a different server instance only from a validated same-origin HTTP state snapshot whose `serverStartedAt` is later than the current epoch. Hold/reject new-epoch WebSocket frames until that snapshot is accepted, then reject all old-epoch frames.
- On local feed loss, mark battle state stale/unavailable and hide cached active status, HP, timers and live commands unless a fresh same-origin HTTP snapshot has reconciled for the current generation. On reconnect, fetch `/api/battle/state` and reconcile WebSocket frames and the HTTP snapshot by epoch/revision so a delayed response cannot roll back newer state. Preserve P4A-C1's connected-plus-fresh-state gate. A backend restart creates a new epoch and empty in-memory battle/forge state; never resume the old encounter or accept its late hits. The dashboard/overlay show unavailable until the new epoch snapshot is reconciled.
- Add strict shared Zod schemas and inferred types in `packages/shared`. Proposed battle snapshot fields: schema version, server instance/epoch, monotonically increasing revision, encounter ID, forge cycle ID, profile ID, status (`idle`, `ready`, `active`, `victory`, `expired`, `cancelled`), boss ID, current/max HP, disclosed weakness, start/deadline timestamps, accepted-hit aggregate, and optional challenge status. No viewer identity is included.
- Battle commands and results are internal typed events, not a public damage API. Only the validated chat adapter can submit a normalized attack event. Owner dashboard mutations are mode-gated: mock mode retains the existing explicit development/simulation-enabled, loopback, Origin/Fetch Metadata and rate-limit guards and requires no Twitch credentials; Twitch mode retains the validated owner session, loopback, strict same-origin/CSRF protections, and a currently verified subscription. The OBS browser and viewers cannot start, cancel, skip or mutate an encounter.
- Build the overlay in the existing React web app and keep `/overlay` read-only. Phaser remains a separate lazy-loaded `/arena` demonstration. `Arena` profile selects the optional demo presentation/path only; it does not make client-side Phaser combat authoritative for a Twitch boss encounter.

### Data-only game profiles

Profiles are versioned JSON parsed by a strict shared schema. Each profile contains only allowlisted presentation and balance configuration: stable profile ID/version, display labels, palette/icon/theme identifiers chosen from bundled assets, encounter duration bounds, base/max HP and damage bounds or approved scaling parameters, cooldown/rate limits, and optional challenge-template IDs. Generic is the fallback and must not depend on any game API. Arena refers to the existing local Phaser demo and may link to it without making it the default flow.

Reject unknown fields and out-of-range values. Profiles cannot contain executable code, arbitrary URLs, HTML, CSS, shell commands, Twitch settings, secrets, or instructions. No runtime profile upload/editor is included in the initial milestones. Configuration changes must remain deterministic and reviewable.

## 4. Battle rules to specify and validate

The battle session is authoritative and bounded. Its lifecycle is explicit; forge reveal never starts a timer or accepts attacks by itself:

- `idle`: no current revealed boss/encounter. A valid `ForgeState(status: "revealed")` with its boss and cycle ID transitions battle state to `ready` and binds that immutable reveal/profile. `ready` is the battle-ready state: no start timestamp/deadline, no timer, and every hit is rejected as `inactive`.
- `ready -> active`: only an explicit owner **Start encounter** action starts the server timer. There is no automatic start timeout; `ready` remains until owner start, a new forge/reset, invalidation, or disconnect policy. The server sets `startedAt` and an immutable deadline; duration is 60–120 seconds.
- `active -> victory`: accepted server-side damage brings HP to zero; close intake before publishing one terminal victory. `active -> expired`: deadline is reached; close intake before publishing expiry. `active -> cancelled`: owner cancellation, verified Twitch loss/revocation/logout, or explicit lifecycle invalidation. All terminal states are immutable.
- Start requires `expectedRevision` and a bounded unique `requestId`/idempotency key. A retry of the same request returns the same result; simultaneous or repeated starts while `active` return a conflict and never reset HP/timer or allocate a second encounter. An explicit owner **Start another encounter** after a terminal result creates a new encounter ID and starts once against the current valid reveal; the terminal snapshot remains visible until this explicit action replaces it. A fresh request ID and current expected revision are required.
- At or after the deadline, reject hits even if the scheduler callback has not run. After victory/expired/cancelled, every late hit is rejected without changing HP, aggregates, revision or terminal result. A later verified Twitch reconnect never resumes a cancelled battle; an owner must have a valid ready reveal/connection and explicitly start again.
- Mock owner controls use only the existing development-only, simulation-enabled, loopback/Origin/Fetch Metadata and rate-limited path; they work without Twitch configuration or OAuth. Twitch controls additionally require the existing validated owner cookie/session, loopback, strict same-origin/CSRF controls, and a fresh verified EventSub subscription. Both modes use explicit owner action. OBS and viewer connections have no administrative controls.
- `!hit` causes base damage; a correct `!hit <weakness>` may apply a bounded multiplier. The weakness is disclosed by the server before combat. Unknown choices, inactive encounters, malformed/oversized messages, unsupported provider/session, duplicates, stale messages, and cooldown/rate-limit violations cause no HP change.
- Deduplicate by trusted EventSub message ID with bounded retention; keep stable viewer identifiers only in volatile server memory for cooldown enforcement. A cooldown is monotonic-clock based and scoped to the encounter. Proposed initial tuning is one accepted hit per viewer per 2 seconds plus a separate bounded global intake/processing rate; both are starting values requiring deterministic load tests and owner tuning, not promises of fairness or final balance. Rejected hits do not extend the attacker's cooldown unless abuse testing shows that is necessary.
- Keep damage integer, nonnegative and capped; clamp HP at zero. The multiplier, per-hit maximum, total intake rate, queue size, dedup retention, and cooldown state all have hard bounds. One viewer cannot create unbounded memory or server work.
- Boss HP scaling is locked at encounter start, deterministic, and bounded by the selected profile. Prefer a streamer-selected audience-size band or fixed profile value for the MVP. Do not inflate HP mid-fight based on raw viewer counts or unbounded attacker arrivals.
- Preserve source isolation: Twitch-mode encounters accept only validated Twitch EventSub events for the authorized broadcaster; mock encounters accept only mock events and stay labeled simulated. No provider fallback or automatic mode switch occurs mid-encounter.
- On verified Twitch session loss, stop Twitch attack intake immediately and publish `cancelled` with a fixed reason code. Never treat missing messages as damage, silently continue with mock traffic, or claim a victory from incomplete data. A fresh verified subscription plus explicit owner action is required before another encounter.

## 5. Milestones M0–M5

Each milestone requires a separate implementation scope, tests, acceptance record, and independent review before merge. This document is not authorization to start any milestone. Phase 4-A is complete and merged through PR #6; implementation of M0–M5 still requires separate explicit owner authorization, followed by the milestone-specific review and merge gates.

### M0 — Product and contract lock

Confirm the journey, command spelling, attack/cooldown/balance values, disconnect policy, Generic profile defaults, challenge safety rules, privacy policy, overlay states and release gate. Write schemas/API/event/state transition diagrams and threat cases before implementation. Prototype layout only if helpful; do not touch OAuth or live Twitch.

**Acceptance:** Product requirements and non-goals are unambiguous; all state transitions have owners; profile schema is strict; attack and disconnect rules are testable; no misleading game-integration claim remains; owner explicitly authorizes M1.

### M1 — Generic forge-to-OBS vertical slice

Deliver the Generic profile on the existing dashboard/overlay path. Preserve the four-stage authoritative forge, existing live/mock integrations, connection freshness/reconciliation, and assembled-boss reveal. Add clear Generic/any-game copy and the battle-ready overlay frame/terminal-state design, but do not claim chat damage works until M2. Before this milestone claims a no-identity-outbound guarantee, split internal normalized chat from strict server-side dashboard/OBS projections and replace the raw dashboard feed with sanitized aggregates.

**Acceptance:** Owner can use the existing real Twitch demo or mock simulation to complete all four categories and reveal a boss. Generic overlay works with an unrelated game running because it requires only OBS Browser Source; no game telemetry or input exists. Mock/live labels, read-only overlay controls, stale-state suppression, and current P4A responsive guarantees pass. Privacy fixtures prove sentinel IDs, names, message text, secrets and errors are absent from dashboard/OBS frames, snapshots, diagnostics and logs across normal, rejected, disconnect and reconnect paths; safe aggregate dashboard activity still updates. Independent security review approves the outbound schema boundary before M2 begins.

### M2 — Server-authoritative Twitch/mock boss encounter

Add `BossBattleSession`, strict shared battle contracts, EventHub publication and Generic profile balancing. Route normalized `!hit`/weakness commands from both existing isolated providers, with deduplication, cooldown, rate caps, locked HP scaling and terminal resolution. Keep Phaser isolated and optional.

**Acceptance:** Deterministic fake-clock/unit/integration tests cover every state transition, duration boundaries, weakness/base damage, overflow/capping, duplicate/stale/wrong-session events, cooldown fairness under ordering, provider isolation, floods, server restart and disconnect cancellation. Start tests cover reveal-to-ready without auto-start, missing/stale owner authorization, no-credential mock start, Twitch owner/session gates, repeated/replayed/concurrent starts, exact deadline and late-hit rejection, and terminal immutability. Battle reconciler tests cover encounter changes, epoch restart, monotonic revisions, conflicting equal revisions, WebSocket generation retirement, HTTP/WebSocket arrival races, stale old-cycle frames, feed loss and fresh snapshot recovery. A mock four-stage forge can proceed to a 60–120 second encounter where only accepted server chat reduces HP and all clients reconcile. Privacy migration and its independent security review from M1 are blocking prerequisites. Owner-controlled live QA separately verifies a genuine attack without exposing identifiers or message content. No synthetic result is described as live.

### M3 — Safe optional challenges and Arena profile

Add a small, data-only allowlist of optional streamer challenges with explicit `complete`/`skip` outcomes and a validated `Arena` JSON profile that preserves the optional Phaser demo. Do not expand Phaser combat. Generic remains the default and functional without Arena or challenges.

**Acceptance:** Challenge copy is safe, brief, accessible, game-independent and skippable; challenge skip/completion cannot block or forge damage, silently change difficulty, or claim observation of game actions. Strict profile tests reject executable/unknown content. Arena demo remains optional, lazy-loaded, and isolated from authoritative chat battle state.

### M4 — Overlay polish, abuse and recovery hardening

Complete OBS-safe presentation, mobile/readability/accessibility checks, reduced-motion behavior, load tests, abuse controls and fail-closed recovery. Tune only using recorded aggregate/synthetic results plus owner feedback; avoid logging chat text or viewer identifiers. Test actual OBS Browser Source separately from Chromium.

**Acceptance:** Screen/viewport matrix and actual owner OBS capture pass; attack bursts stay within CPU/memory limits; no duplicate damage; reconnect requires validated welcome/subscription and explicit fresh encounter; local server loss visibly removes authoritative live state; no OAuth/session/CSRF/EventSub boundary regresses. Record live Twitch evidence separately from fake transport, mock simulation and Chromium.

### M5 — Controlled demo/release readiness

Package a reproducible local setup and owner-run demo: Generic Browser Source, real Twitch four-stage forge, one real chat attack/weakness interaction, a complete encounter, and optional challenge skip. Retain a mock path. Audit README, privacy/security claims, screenshots and known limitations. Reserve the final day for Twitch validation, OBS recording, a public YouTube demo, Codex session evidence and Devpost preparation/submission. Request independent exact-head review before an owner merge decision.

**Acceptance:** Release checklist distinguishes independently run automated tests, Chromium evidence, actual OBS owner evidence and owner-supplied Twitch results. A fresh environment can run the clearly labeled mock demo without credentials. Real mode remains opt-in, loopback-only and personally authorized. No public deployment, cloud host, publication, hackathon submission or merge happens without separate explicit approval.

### Dated checkpoints and protected submission window (Asia/Manila)

These are proposed checkpoints against the fixed **Tuesday, November 3, 2026, 06:00 PHT** deadline. They are planning targets, not a promise of available owner time or authorization. Security/review gates are not shortened to recover schedule.

| Milestone                                    | Checkpoint (PHT)                    | Exit focus                                                                                                       |
| -------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| M0 — Contract lock                           | Wed Oct 28, 13:00–18:00             | Resolve state/privacy/command contracts; obtain explicit authorization before implementation.                    |
| M1 — Generic forge-to-OBS + privacy boundary | Thu Oct 29, 09:00–18:00             | Usable Generic OBS path; sanitized server-side event projections and privacy tests.                              |
| M2 — Server-authoritative battle             | Fri Oct 30, 09:00–Sat Oct 31, 12:00 | Real and mock `!hit`/weakness intake, HP, terminal result, freshness/restart/disconnect tests; priority over M3. |
| M3 — Challenges and Arena profile            | Sat Oct 31, 12:00–Sun Nov 1, 12:00  | Optional only; safe challenge completion/skip and Arena JSON profile. Drop first if M2 or M4 risks slip.         |
| M4 — Hardening and acceptance                | Sun Nov 1, 12:00–Mon Nov 2, 06:00   | Abuse/privacy/security review, regression gates, Chromium and actual OBS owner QA readiness.                     |
| M5 — Demo/evidence/submission window         | Mon Nov 2, 06:00–Tue Nov 3, 06:00   | Complete owner-approved validation and assemble reviewable evidence; owner controls publication/submission.      |

Protect this M5 time inside the final day: Nov 2 06:00–09:00 for owner-controlled real Twitch validation; 09:00–11:00 for actual OBS recording; 11:00–16:00 for YouTube demo recording/edit/review; 16:00–17:00 for authentic Codex development/session evidence; and 17:00–Nov 3 06:00 for Devpost preparation and owner review/submission. These reservations do not authorize OAuth, live votes, publication or submission in this planning task. A YouTube publication and Devpost submission each require the owner's separate authorization; never invent a Codex session ID or claim a submission before the owner completes it.

## 6. Risks and controls

| Risk                                                                                 | Control / evidence required                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat spam or command floods consume resources or trivialize the encounter            | Strict message/size/schema limits; bounded per-viewer and global monotonic rate limits; queue/memory caps; bounded dedup; no per-message logging; flood and boundary tests.                                                                                                   |
| Cooldowns feel unfair across latency, bursts or returning viewers                    | Apply server receipt ordering consistently; document accepted-hit cooldown; only accepted hits consume it initially; test deterministic same-time ordering, reconnect, and multi-viewer bursts; tune with owner QA. Do not claim equal network latency.                       |
| Attack balance makes the boss impossible or instantly defeated                       | Lock deterministic HP at start; profile-clamp base/bonus damage and duration; simulate low/medium/high participation; disclose weakness; tune with owner feedback. Never adapt HP secretly during combat.                                                                     |
| EventSub loss, logout or backend restart creates false victory or lost state         | Fail closed; stop intake and cancel with visible reason; publish authoritative state; do not auto-resume or synthesize attacks; require fresh verified subscription and owner start. Document in-memory reset behavior.                                                       |
| Display-name privacy or hostile chat text leaks to OBS/logs                          | Do not show or persist display names in the MVP; use aggregate counts. Keep required stable Twitch IDs server-side in volatile bounded cooldown/dedup state only. Never log raw frames, chat text, IDs, names, tokens or full errors; render any future approved text safely. |
| “Any-game integration” is misunderstood as arbitrary game integration                | Use precise copy: OBS Browser Source that runs alongside a game; no telemetry, detection, control, or compatibility guarantee beyond the browser source. Keep per-game features explicitly out of scope.                                                                      |
| Generic profile becomes dependent on Arena code                                      | Generic is the default, schema-valid data-only profile and tested without Phaser. Lazy-load Arena; isolate presentation adapters.                                                                                                                                             |
| Optional challenges imply streamer actions were detected or pressure unsafe behavior | Use an allowlisted safe prompt library, explicit streamer self-report complete/skip, no sensing, no penalty, and no effect on battle timing or truth of the overlay.                                                                                                          |
| Live and mock evidence are conflated                                                 | Separate provider labels, test fixtures, acceptance sections and demo recording. Owner-supplied live results must be marked as such and never inferred from simulation.                                                                                                       |

## 7. Security and privacy invariants

- Bind Fastify and Vite to loopback only. No tunnel, public endpoint, cloud hosting, or unauthenticated remote control.
- Twitch stays disabled by default. Reuse the verified owner OAuth/session, exact local callback, CSRF/Origin/Fetch Metadata controls, scoped user token handling and in-memory lifecycle. Do not request or display secrets; no token reaches browser, overlay, EventHub, logs, screenshots, or profile JSON.
- Accept battle commands only after validated EventSub welcome, correct broadcaster/reader/subscription/session, valid message type/time, normalization and dedup. Keep old-socket, stale-session, replay, revocation, reconnect and fail-closed safeguards.
- Mock and Twitch data are never converted into each other. Mock battles remain explicitly simulated. Disconnects do not fall back to mock or resume automatically.
- Owner mutations require existing owner authorization and same-origin checks; overlay and public-facing browser state remain read-only.
- Enforce schema validation and resource bounds at ingress and event publication. Profile JSON is data only. Viewer identifiers needed for abuse controls remain ephemeral and never leave server memory; display names and chat content are not used for battle display or diagnostics.
- Keep human-controlled independent review and merge approval. No automatic merge, deployment, publication, release, or Phase 5 submission.

## 8. Schedule-slip fallbacks and release priorities

Keep one complete, usable **Generic** experience and preserve the existing real Twitch demonstration path at every cut. A schedule cut removes optional breadth before the end-to-end loop:

1. **Must retain (P0):** A usable Generic OBS Browser Source; existing verified real Twitch forge demo and clearly labeled credential-free mock mode; one genuine, server-authoritative chat hit using the disclosed weakness, boss HP display and a bounded 60–120 second outcome; strict event privacy projections; dedup/cooldown/rate bounds; read-only overlay; disconnect fail-closed behavior. This Generic + genuine-hit vertical slice outranks optional breadth.
2. **Can defer (P1):** Challenges, the Arena JSON profile, additional profiles/themes, challenge history, advanced animation, statistics, and any profile-selection UI beyond Generic default. Keep the current Phaser arena intact but do not expand it.
3. **Do not substitute:** If authoritative battle or genuine Twitch verification slips, do not claim Phaser client damage or mock traffic is the live product. Keep the current real Twitch forge demo intact and label combat preview as incomplete. A usable mock Generic run may demonstrate mechanics, but it is not live proof.
4. **Cut scope rather than security:** Never remove owner authentication, event validation, local-only binding, rate limits, provider isolation, server-side privacy projections, freshness/reconciliation, or independent review to meet a date.

Release claims must say “OBS overlay that runs alongside a game” and may claim live chat damage only after verified end-to-end owner QA and independent review. “Works with any game” must not imply game-specific support or telemetry.

## 9. Verification and review gates

Each implementation milestone must report actual checks, not inherited plans: frozen install; build; typecheck; lint; formatting; full tests; `git diff --check`; deterministic mock simulation; browser responsive/security states; and targeted fake EventSub/session/battle tests. Use fake clocks, sockets and HTTP in automated tests; no credentials or Twitch network. Browser tests prove rendering only. Only owner-run consent/OBS/chat evidence can establish live operation, and it must be identified as owner-supplied unless independently reproduced.

Before M2 merge, require independent exact-head review of battle authority, spam bounds, damage balance, dedup/cooldown ordering, session separation, disconnect semantics, privacy, and all existing OAuth/EventSub/loopback/CSRF protections. Keep implementation PRs Draft until their evidence is reviewable; the owner retains merge control.

## 10. Current gates

- The current baseline is `main` at `5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`; it contains Phase 4-A PR #6 and this approved-for-planning PDCP-001 proposal merged via PR #7. P4A retains completed frontend/mobile acceptance and owner-supplied OBS visual PASS. See [P4A acceptance](ACCEPTANCE.md#p4a-final-acceptance-closure--owner-supplied-obs-visual-qa) and [OBS evidence](P4A-STREAMER-OBS-READINESS.md#owner-supplied-obs-visual-qa-results).
- The prior independent PDCP-001 exact-head delta review passed at `adfaa6f5000b330c393a6e50dcc20c7125d1519e` ([review](https://github.com/mrdzyn/bossforge/pull/7#issuecomment-6461839234)). PR #7 merged the planning proposal; it did not implement M0–M5.
- The current EventHub broadcasts normalized chat containing viewer identity and message text to browser WebSocket clients. The server-side privacy migration and strict recipient projections specified in M1 are **not implemented** and block M2. Do not claim browser privacy from hidden UI or schemas that have not been added and tested.
- `!hit` combat, server-authoritative boss HP, and Generic/Arena profiles are **not implemented**. Phase 4-A voting and the optional Phaser demo remain the current shipped experience.
- M0 contract-lock documentation is now tracked separately. M1–M5 implementation, live battle QA, release, publication, and Phase 5 submission are not started or authorized by this planning document. PR #7 is merged; preserve separate owner authorization and exact-head independent review gates for each implementation scope.
