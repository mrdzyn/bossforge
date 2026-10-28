# M0 — Any-Game Twitch Engagement Contract Lock

**Status:** Documentation-only contract proposal on `docs/m0-any-game-contract-lock`, based on `main` at `5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`. No M1/M2 implementation is authorized by this document.
**Product promise:** **Chat creates the boss. Chat fights the boss. The streamer keeps playing their game.**
**Current truth:** The shipped product is the four-stage forge, local verified Twitch voting path, and optional Phaser arena. Privacy-safe browser projections, `!hit` combat, server-authoritative battle HP, and Generic/Arena profile loading are not implemented.

## 1. Locked experience and boundaries

1. The streamer opens the local dashboard, selects the Generic experience, connects the existing Twitch integration through its owner-controlled flow, and adds the read-only `/overlay` Browser Source to OBS. Mock mode is credential-free and clearly labeled **SIMULATED**.
2. Viewers create a boss through the existing `body`, `element`, `special`, and `weakness` forge stages. Existing P4A commands remain exactly `!vote <category> <choice>` for the active category; existing live commands still require verified Twitch connection and fresh authoritative state.
3. A valid forge reveal binds an immutable boss/profile/forge-cycle snapshot and changes battle state from `idle` to `ready` (**BATTLE READY**). Reveal does not start a battle timer and does not accept hits.
4. The streamer explicitly clicks **Start Battle** in the authenticated local dashboard. The server changes `ready` to `active`, records the start/deadline and begins the timer.
5. During `active`, viewers may send `!hit` for base damage or `!hit <element>` for a weakness attack. The only recognized elements are the existing `BossAttributesSchema.weakness` vocabulary: `water`, `light`, `earth`, and `wind`. The server alone validates and applies damage.
6. OBS presents the forged boss identity, current/max HP, aggregate accepted-attack activity, disclosed weakness, attack instructions, remaining time, accurate **LIVE TWITCH** or **SIMULATED** disclosure, and terminal outcome. It never renders viewer names/IDs, chat text, OAuth data, or administrative controls.
7. The streamer remains the encounter host, not the opponent. The new battle is cooperative: accepted chat attacks reduce boss HP. It does not observe or control the streamer’s game. No gameplay telemetry, process/screen reading, input injection, arbitrary-game integration, or multiplayer is included.
8. Phaser `/arena` remains an optional self-contained local demo with its existing player-versus-boss rules. Its `community-won` and `streamer-won` statuses and client-side HP are not aliases for the Twitch battle’s `victory` or `expired` outcomes. Phaser receives no gameplay expansion in M0–M5.

## 2. Terminal outcomes and audience win condition

The server serializes accepted hits, deadline, and disconnect signals through one battle event loop. Terminal state is immutable for that encounter.

| Trigger                                                                                     | Authoritative status | Exact overlay copy                                  | Rule                                                                                                         |
| ------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Accepted damage reaches zero HP strictly before the deadline                                | `victory`            | **COMMUNITY VICTORY! BOSS DEFEATED!**               | Stop intake and timer before publishing the terminal snapshot. This is the sole community victory condition. |
| Deadline is reached with HP greater than zero                                               | `expired`            | **BOSS SURVIVED! TRY AGAIN!**                       | Stop intake before publishing. Do not call this a streamer victory.                                          |
| Verified Twitch disconnect/revocation/logout, owner cancellation, or encounter invalidation | `cancelled`          | **BATTLE CANCELLED** plus a fixed safe reason label | Never show victory or continue accepting attacks. Reconnect does not resume the encounter.                   |

Use explicit status labels for **BATTLE READY**, active countdown, terminal state, **TWITCH DISCONNECTED**, **SIMULATED**, and **SERVER LINK UNAVAILABLE / BATTLE STATUS UNKNOWN**. On local feed loss, stale HP/countdown/live prompts are not presented as current. Restore active presentation only after fresh authoritative state reconciles for the current connection generation. The overlay has no buttons or mutation controls.

## 3. Recommended deterministic balance defaults

These are proposed M0 contract values and mathematical examples, not tested tuning or claims of live fairness. Lock them in shared strict profile data, then verify with deterministic simulation and owner QA before release claims.

| Parameter                         | Recommended default                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Encounter duration                | 90 seconds; owner may choose 60, 90, or 120 seconds; hard bounds 60–120 seconds                                          |
| Base attack                       | `!hit` applies 8 integer damage                                                                                          |
| Weakness attack                   | `!hit water`, `!hit light`, `!hit earth`, or `!hit wind`; only the disclosed current weakness gets multiplier 7/4 (1.75) |
| Damage rounding                   | Positive integer round-half-up: `floor((baseDamage * 7 + 2) / 4)`; with base 8 this is exactly 14                        |
| Per-hit and per-encounter maximum | 14 damage per accepted command; HP is clamped to zero; no attack can apply negative or fractional damage                 |
| Per-viewer cooldown               | 2,000 ms monotonic time, scoped to one encounter; starts only after an accepted hit                                      |
| Audience HP band                  | Owner selects `low`, `medium`, or `high` before start; never derive or continuously alter it from Twitch viewer counts   |

### Generic profile balance bands

| Owner-selected expected cohort             | `maxHp` | Use                           |
| ------------------------------------------ | ------: | ----------------------------- |
| `low` (about 1–3 active attackers)         |     400 | Small chat / solo viewer      |
| `medium` (about 4–10 active attackers)     |   1,700 | Moderate chat                 |
| `high` (about 11–30 or larger active chat) |   5,200 | Large chat; cap the band here |

The audience band is a streamer-selected expectation, not a count, estimate, or API read of current viewers. A higher live chat volume can hit the global cap; it cannot cause HP to grow during battle. Profiles must bound any later HP changes to an explicit reviewed finite enum.

### Deterministic 90-second sample encounters

For a reproducible comparison, assume every participating viewer sends one command every five seconds at `t = 0, 5, …, 85` seconds. Spread initial viewer phases deterministically across the first five seconds. For each viewer, every third command matches the disclosed weakness and the other two are base attacks. That yields 18 commands/viewer, 12 base and 6 weakness commands, or `12×8 + 6×14 = 180` damage/viewer. This is a sample workload only, not predicted behavior.

| Active viewers | Selected band / HP | Commands | Sample damage | Result under this workload                                                                                                                             |
| -------------: | ------------------ | -------: | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
|              1 | low / 400          |       18 |           180 | No victory in this moderate-cadence sample (45% HP); a solo viewer at the 2-second accepted-hit limit can deal enough damage to win before 90 seconds. |
|              3 | low / 400          |       54 |           540 | Community victory at approximately 67 seconds under evenly phased arrivals.                                                                            |
|             10 | medium / 1,700     |      180 |         1,800 | Community victory at approximately 86 seconds.                                                                                                         |
|             30 | high / 5,200       |      540 |         5,400 | Community victory at approximately 87.5 seconds; this sample stays below the 8/s global token refill rate.                                             |

At the per-viewer cooldown limit, the aggregate allowed attempt rates before the global cap are 0.5/s, 1.5/s, 5/s, and 15/s for 1, 3, 10, and 30 viewers. The global accepted-command limit below caps the last group at 8/s. These ceilings are intentionally not the sample cadence: approximate mean 10-damage throughput is 5, 15, 50, and 80 HP/s respectively. They imply about 80 seconds for one low-band viewer, 27 seconds for three low-band viewers, 34 seconds for ten medium-band viewers, and 65 seconds for thirty high-band viewers. All-weakness arrivals can be faster, but never exceed 14 damage per command or the processing cap. This is arithmetic only; it has not been simulated or tuned.

### Processing, replay and memory bounds

- Parse only normalized, size-bounded chat messages. A dedicated ingress budget should cap all normalized chat considered by the battle router at 50 messages/second with burst 100; only a strictly parsed `!hit` candidate enters the battle command queue. Never log raw messages.
- Accepted-command token bucket: refill at 8 commands/second, burst capacity 16. Queue at most 64 commands; maximum queue age 500 ms. Order by server monotonic receipt time and a server sequence number. On bucket exhaustion, queue overflow, or queue-age expiry, reject with a fixed aggregate reason and no HP/cooldown mutation.
- Deduplicate syntactically valid attack message IDs for 10 minutes, across reconnects and encounter transitions. Maximum 10,000 retained IDs. Record the ID before queueing so retrying a dropped/rejected copy cannot later apply damage. If capacity is exhausted before entries expire, fail closed for new attack candidates until capacity is available; do not evict an unexpired ID to make room.
- Keep at most 5,000 active cooldown entries for the current encounter. Derive an opaque per-process HMAC pseudonym from the provider and viewer ID; keep no display name. Expire cooldown entries at 2 seconds and clear encounter cooldowns on terminal state. At capacity, reject unknown viewers with fixed `busy` status until entries expire.
- Bound event/text payloads by the existing EventSub normalizer limits, battle command grammar to exact `!hit` or `!hit <water|light|earth|wind>` with no trailing content, and profile values to strict schemas. Keep only bounded fixed-code counters and aggregates for diagnostics.

### Exact ordering and rejected-hit semantics

1. First validate provider/session/subscription and normalized event schema; reject cross-provider, wrong broadcaster/session, invalid timestamp, malformed, oversized, or stale input before battle handling. Use the existing EventSub validation and freshness rules.
2. Record a server monotonic receipt time and sequence. Deduplicate attack message IDs before enqueue. A duplicate never applies damage, increments accepted aggregates, or changes cooldown.
3. At processing, accept only when status is `active`, the current encounter/provider/session matches, receipt time is strictly before the server deadline, the hit is well-formed, and limits permit it. Unknown element words are rejected. A recognized but nonmatching element is recommended to count as a base attack (no multiplier) with a fixed `weakness_mismatch` aggregate reason/metric; it must not be silently described as a weakness bonus.
4. **Deadline rule:** hits with server receipt time `< deadline` may drain from the bounded queue in sequence order before the expiry transition. At receipt time `>= deadline`, first close intake and resolve expiry after all earlier in-deadline queued items have either been applied or explicitly rejected as queue-expired. No message arriving at the exact deadline can count. A scheduler callback firing late cannot extend the acceptance window.
5. On an accepted hit, consume the viewer cooldown, increment aggregate accepted/base/weakness hit counts and damage, clamp HP to zero, and increment battle revision. If HP becomes zero, close intake and transition once to `victory` before any later queued event can mutate state.
6. Rejected hits never consume per-viewer cooldown, reduce HP, increase accepted aggregates, or alter outcome. Security-level ingress/global budgets may still count attempts. Reserve dedup IDs for valid `!hit` candidates even when they are subsequently rejected or queue-dropped. Expose only fixed rejection aggregates to the dashboard.

### Initial replay and reconnection policy

- A transport or verified subscription loss immediately pauses Twitch intake and cancels an active or battle-ready Twitch encounter as `cancelled` with fixed reason `twitch_disconnected` or `twitch_session_invalidated`. Keep fail-closed semantics; do not automatically resume or fall back to mock.
- A fresh validated EventSub welcome and enabled Helix subscription are necessary before an owner can start a new Twitch battle. Reconnect by itself cannot reopen the canceled encounter.
- Keep message-ID deduplication through reconnect for its 10-minute TTL; the same viewer/message cannot be applied twice. Per-viewer cooldown remains process-memory-only and encounter-scoped. Backend restart creates a new server epoch and empty state; it never resumes HP, cooldowns, or an encounter. Stale old-epoch events and frames are rejected.
- Keep raw viewer IDs only transiently at ingress and in the private, bounded pseudonymization step. Do not serialize pseudonyms, viewer/message IDs, names, or chat text to dashboard, OBS, snapshots, diagnostics, or logs.

## 4. Battle state and reconciliation contract

Use a new server contract, tentatively `CommunityBattleStateV1`, in `packages/shared`. Do not reinterpret the existing Phaser-oriented `BattleStateSchema`: it contains named player records and statuses `lobby`, `voting`, `active`, `streamer-won`, and `community-won`, which are not this cooperative server battle.

### Snapshot fields

Every strict snapshot contains:

- `schemaVersion: 1`;
- `serverInstanceId` and `serverStartedAt` (the server epoch; generated at process startup);
- monotonically increasing `revision`, starting at zero for a new process and never resetting for a new encounter within that process;
- status `idle | ready | active | victory | expired | cancelled`;
- nullable `encounterId` and `forgeCycleId`; ready/active/terminal snapshots require both;
- an immutable `bossSnapshot` (stable boss ID, displayed name, body/element/special/weakness, and relevant presentation attributes) and immutable Generic profile `{profileId, profileVersion, profileSnapshot}` once ready;
- nullable `audienceBand` and `durationSeconds` while `ready`; Start Battle selects the band and duration atomically, then they are immutable. `ready` has no timer, `active` has `startedAt` and `deadlineAt`;
- nullable integer `currentHp` and `maxHp` in `idle`/`ready`; active and post-start terminal states require `0 <= currentHp <= maxHp` and `maxHp > 0`. A `ready` cancellation has no HP values;
- safe aggregate counts: `acceptedHitCount`, `baseHitCount`, `weaknessHitCount`, `damageApplied`; no per-viewer or per-message values;
- nullable fixed `cancelReason` enum; non-cancelled states must carry null.

No viewer, chat, secret, bearer, cookie, free-form error, diagnostic, or OAuth fields are permitted. A separate aggregate dashboard projection may include fixed-code rejection totals; the overlay schema should include only public forge/battle state, connection/mode labels, and privacy-safe aggregate activity.

### Transition table

| From     | To          | Trigger and required guard                                                                                                                                                                                                                                                                              |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`   | `ready`     | Server accepts the current authoritative forge reveal with a non-null boss and cycle ID, validates and snapshots the Generic profile, creates a new encounter ID, leaves timer/HP uninitialized, and increments revision.                                                                               |
| `ready`  | `active`    | Authorized owner Start Battle request with matching forge cycle/current battle revision and verified mode/provider. The request selects valid duration/band from the snapshotted profile, initializes full HP, creates immutable deadline from server monotonic/wall clock pair, and starts timer once. |
| `ready`  | `cancelled` | Owner cancels or bound forge/provider/session becomes invalid before start.                                                                                                                                                                                                                             |
| `active` | `victory`   | An accepted in-deadline hit reduces HP to zero.                                                                                                                                                                                                                                                         |
| `active` | `expired`   | Deadline is reached after resolving only queued events whose server receipt was strictly earlier. HP remains greater than zero.                                                                                                                                                                         |
| `active` | `cancelled` | Owner cancels, Twitch session/revocation/verified EventSub is lost, or required authoritative state is invalidated.                                                                                                                                                                                     |
| terminal | `idle`      | Only an explicit owner action beginning a new forge cycle/rematch may retire the terminal encounter. The terminal record remains published until the new cycle is accepted; it cannot go directly terminal-to-active.                                                                                   |

All other transitions are rejected without revision/state changes. Terminal snapshots are immutable. Start retries with the same idempotency key and identical request return the original accepted result; the same key with different parameters returns conflict. New battle requires a new request key and new encounter ID. No late hit, duplicate, reconnect, HTTP retry, or browser frame can mutate terminal state.

### Battle-specific reconciler

Implement `BattleStateReconciler`; never pass `CommunityBattleStateV1` into `ForgeStateReconciler`. Reuse P4A-C1 principles but compare battle-specific identity and revision:

- A WebSocket attempt increments a client-local generation; discard all callbacks from retired sockets.
- Apply only a schema-valid state for the currently accepted `serverInstanceId`/`serverStartedAt` epoch and current `encounterId`; reject lower revisions and conflicting payloads at equal revision; identical equal-revision snapshots may be idempotent.
- A new process epoch may be adopted only from a fresh same-origin HTTP snapshot on the current generation. Hold/reject new-epoch WebSocket state until that snapshot is accepted; after adoption reject all old-epoch HTTP/socket replies.
- Reconcile `/battle/state` HTTP snapshots and WebSocket events through the same revision logic. A request captures generation and epoch; delayed responses from older generations/encounters cannot roll state back.
- On local event-stream loss mark state unavailable immediately and hide cached active HP, timer, and live instructions. Re-enable only after the current generation reconnects and fresh authoritative snapshot reconciles. Preserve existing P4A live-plus-fresh-state behavior.
- Backend restart begins a new epoch with `idle`; no old battle is restored, no old hit is accepted, and no automatic resume occurs.

## 5. Generic profile and owner API contracts

### Strict data-only Generic v1 profile

Recommended shape (illustrative JSON, all numeric limits enforced by strict shared Zod schema):

```json
{
  "profileId": "generic",
  "version": 1,
  "display": { "themeId": "generic-default", "label": "Generic" },
  "encounter": {
    "minDurationSeconds": 60,
    "defaultDurationSeconds": 90,
    "maxDurationSeconds": 120,
    "audienceHp": { "low": 400, "medium": 1700, "high": 5200 },
    "baseDamage": 8,
    "weaknessMultiplier": { "numerator": 7, "denominator": 4 },
    "maxDamagePerHit": 14,
    "perViewerCooldownMs": 2000
  },
  "limits": {
    "chatIngressPerSecond": 50,
    "chatIngressBurst": 100,
    "acceptedHitsPerSecond": 8,
    "acceptedHitsBurst": 16,
    "queueCapacity": 64,
    "maxQueueAgeMs": 500,
    "dedupeTtlMs": 600000,
    "maxDedupeEntries": 10000,
    "maxTrackedViewers": 5000
  },
  "challengeIds": []
}
```

`themeId` resolves through a compiled allowlist of bundled assets; profile data cannot supply URLs, HTML, CSS, arbitrary colors outside a reviewed token set, scripts, executable code, shell commands, credentials, or free-form overlay markup. Unknown properties, non-finite/out-of-range numbers, invalid IDs, and unsafe values fail schema validation. Generic must load and work without Phaser. Arena profile and challenge templates are deferred; challenges default to none.

### Proposed local owner endpoints (not yet implemented)

| Method/path               | Contract                                                                                                                                                                                                                                                                                                                             | Success                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `GET /battle/state`       | Loopback-only, same local read access pattern as `/forge/state`; strict privacy-safe `CommunityBattleStateV1` snapshot.                                                                                                                                                                                                              | `200` snapshot, `Cache-Control: no-store` recommended                             |
| `POST /dev/battle/start`  | Owner-only request: `{ requestId: UUID, expectedRevision, forgeCycleId, durationSeconds: 60\|90\|120, audienceBand: low\|medium\|high }`. The owner chooses duration and audience band in the ready dashboard before clicking Start Battle. Server validates them against the immutable profile snapshot and all mode-specific auth. | `200` accepted active snapshot; identical idempotent retry returns same encounter |
| `POST /dev/battle/cancel` | Owner-only request: `{ requestId: UUID, expectedRevision, encounterId }`; server supplies fixed reason `owner_cancelled`, never accepts arbitrary reason text.                                                                                                                                                                       | `200` terminal cancelled snapshot; identical retry is idempotent                  |

These are local owner operations, not public damage routes. There is **no** HTTP/WebSocket route by which browser, viewer, OBS, or Phaser can submit damage. Only validated normalized chat can call the internal server attack processor.

**Mock mode:** credential-free, explicit development/simulation-enabled mode; loopback peer required; preserve existing Origin/Fetch Metadata protections, permitted local dashboard browser origin, documented originless-loopback CLI exception only where the existing dev simulation contract allows it, and route rate limit. Do not use this exception for Twitch owner mutations.

**Twitch mode:** integration remains opt-in/disabled by default. Require existing valid streamer owner session cookie, loopback peer, exact allowed same-origin `Origin`, required `Sec-Fetch-Site: same-origin` on POST, verified active EventSub subscription, and existing CSRF/session checks. Fail closed on missing/revoked owner session, lost subscription, provider mismatch, or stale forge state. Never auto-switch to mock.

Return fixed sanitized errors; do not echo payloads or identity:

| HTTP | Code                                                                                                       | Meaning                                                                  |
| ---: | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
|  400 | `invalid_request`                                                                                          | Malformed schema, duration, band or idempotency key                      |
|  401 | `owner_auth_required`                                                                                      | Twitch-mode owner session is missing/invalid                             |
|  403 | `local_access_denied` / `origin_rejected` / `mode_disabled`                                                | Not loopback, Origin/Fetch Metadata failed, or dev operation unavailable |
|  409 | `battle_not_ready`, `revision_conflict`, `encounter_active`, `provider_unverified`, `idempotency_conflict` | State/provider/request conflict; no state mutation                       |
|  429 | `rate_limited`                                                                                             | Owner operation limit exceeded                                           |
|  503 | `state_unavailable`                                                                                        | Authoritative state or service is closing/unavailable                    |

Response messages remain generic/sanitized. Error bodies, logs and diagnostics contain no cookies, tokens, raw chat, IDs, full error objects, or OAuth URLs.

## 6. M1/M2 bounded PR execution handoff

Each row is a separate Draft PR with a narrowly named branch, own exact-head review, tests, and acceptance record. Do not bundle M1 privacy and M2 battle logic into one unreviewable change.

| Scope                                           | Bounded deliverable                                                                                                                                                                                                         | Exit criteria                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1-A — Privacy-safe outbound projections**    | Keep `NormalizedChatEvent` internal; replace universal raw EventHub broadcast with strict versioned recipient-specific dashboard/overlay projections, safe aggregate activity, and privacy-safe snapshots/diagnostics/logs. | Sentinel IDs/names/message IDs/text/tokens/secrets/full errors are absent from serialized dashboard and OBS frames, HTTP snapshots, diagnostics and logs in mock/Twitch-shaped valid/rejected/disconnect/reconnect/restart tests. Strict schemas reject `chat.event` and unknown sensitive keys. Independent security review PASS. **Hard blocker for M2.** |
| **M1-B — Generic OBS and dashboard states**     | Generic mode labels, four-stage forge handoff to BATTLE READY, read-only overlay mock/live/disconnected/unknown states, fresh snapshot behavior and battle-ready/read-only dashboard presentation. No chat damage yet.      | No false LIVE status or stale HP/countdown; Generic works without Phaser; mock stays credential-free; real commands only with verified live/fresh state. Must consume M1-A projections for any browser path; no private-event bypass.                                                                                                                       |
| **M2-A — Server battle engine/contracts**       | Strict `CommunityBattleStateV1`, Generic v1 schema, `BossBattleSession`, explicit transitions, owner Start Battle, revision/epoch, HP, deadline, cancellation, idempotency and battle reconciler.                           | Fake-clock tests for all transitions, monotonic revisions, deadline ordering, terminal immutability, duplicate start, restart epoch and stale HTTP/WS frames. No chat ingress until privacy M1-A review gate passes.                                                                                                                                        |
| **M2-B — Chat command routing and rate limits** | Internal Twitch/mock `!hit` parser/router, source isolation, weakness rules, dedup/cooldown, global rate/queue/memory bounds and aggregate diagnostics.                                                                     | Fake EventSub/session tests prove only validated source reaches active battle, no public damage route, no cross-provider/replay/late hit, exact caps, fixed rejection reasons and zero identity outbound. **No genuine live-hit claim before M1-A + M2-A/B audits.**                                                                                        |
| **M2-C — OBS battle UI and full integration**   | Compose privacy-safe forge/battle snapshots and aggregate events in dashboard and read-only Generic overlay; status, HP, weak point, timer, outcome copy and instruction display.                                           | Dashboard/overlay reconnect and epoch tests; responsive Chromium; no admin controls or stale state. Owner OBS application evidence is separate from Chromium QA.                                                                                                                                                                                            |
| **M2-D — Deterministic tests and owner QA**     | Integrate test matrix, simulation, abuse/recovery checks, acceptance docs and controlled owner QA plan. This scope coordinates evidence; it cannot claim a pass from fixtures.                                              | Full repository gates and synthetic 4-stage-to-battle acceptance; independent exact-head security review; then owner-controlled real Twitch authorization and genuine chat test, separately recorded. Only verified owner live evidence plus review permits live feature claims.                                                                            |

**M1 gates that block M2:** M1-A schema/recipient segregation merged and exact-head independently security-reviewed; sentinel absence proven in both dashboard and OBS serialization, snapshots, diagnostics and logs; dashboard aggregate usefulness retained; strict rejection of raw `chat.event`; existing P4A freshness/privacy/security controls unchanged. M1-B must not create a parallel raw-event path.

**M2 gates that block live claims:** M2-A/B/C/D deterministic tests and full repo gates pass; exact-head independent review approves attack authority, balancing, abuse caps, replay/cooldown, session/provider separation, cancellation, reconciliation and privacy; no genuine vote is inferred from mocks; owner personally performs Twitch consent and real chat testing; OBS application evidence is labeled owner-supplied unless independently reproduced. No automatic reconnect resume or fake vote may be claimed.

## 7. Decisions requiring owner approval before implementation

1. Approve/revise proposed damage `8`, multiplier `7/4`, 2-second accepted-hit cooldown, 400/1,700/5,200 HP bands, 8/s global accepted-hit rate, burst 16, queue 64/500 ms, 10-minute/10,000-entry dedup, and 5,000 cooldown entries. These are deterministic starting contracts, not tested balance.
2. Choose the initial audience band UX/default. Recommendation: make the owner choose `low`/`medium`/`high` before battle; if a default is required, default `medium` but visibly allow `low` for solo/small chat. Never infer it from current Twitch viewer count.
3. Confirm semantics for a recognized but nonmatching element argument. Recommendation: accept it as base 8 damage, no multiplier; unknown words are rejected. A stricter alternative is to reject every wrong element. Decide before M2-B.
4. Confirm whether attack counters expose separate base/weakness counts on OBS or only total accepted attacks. Recommendation: OBS displays aggregate total and HP only; dashboard may show safe aggregate base/weakness/rejection counters.
5. Approve M1-A as mandatory pre-M2 work. It closes an existing privacy exposure; it is not a claim that current browser events are safe.

Until these decisions and the M0 exit audit are accepted, M1/M2 implementation remains unauthorized.

## 8. Deadline, fallback and release gate

Protect the approved PDCP-001 deadline: **November 3, 2026, 06:00 Asia/Manila**. Follow the dated M0–M5 schedule and reserved evidence/submission windows in [PDCP-001](PDCP-001-ANY-GAME-TWITCH-ENGAGEMENT.md). Security review, owner consent, OBS recording, public YouTube publication, Codex session evidence, and Devpost submission each retain separate gates.

Priority remains: (1) secure Generic OBS, (2) genuine Twitch chat attack, (3) server-authoritative HP, (4) cooperative Community Victory, (5) reliable demo/submission evidence. Defer challenges, Arena profile polish, extra themes, and advanced effects first. Preserve the existing real Twitch forge demonstration and credential-free simulation. If the server battle or privacy boundary slips, demonstrate only the completed forge/Phaser path and explicitly label the new battle incomplete; never imply Phaser combat or simulated traffic proves Twitch battle damage.

## 9. Existing code observations used for this lock

- `packages/shared/src/index.ts` currently includes viewer IDs, display names and text in `NormalizedChatEventSchema` and `AppEventEnvelopeSchema`; it also has a Phaser-oriented `BattleStateSchema` with `players`, `streamer-won`, and `community-won`. This new cooperative contract must be separate.
- `apps/server/src/events/event-hub.ts` serializes one `AppEventPayload` and broadcasts it to every WebSocket client. `apps/server/src/app.ts` currently calls `hub.publish` for normalized mock/Twitch chat before/alongside forge processing. That browser payload is not privacy-safe; M1-A must move the boundary server-side.
- Current dashboard state uses `ForgeStateReconciler`, connection generations, HTTP snapshot polling and stale-state suppression in `useLiveEvents`. Battle requires a separate reconciler with encounter identity/revision/epoch while preserving these freshness principles.
- Current `ForgeSession` owns vote phases, timestamps, ballots and boss reveal. Reveal has no new battle lifecycle today. Server attack processing, battle timers, HP and these contracts are proposals only.
- `packages/shared/src/combat.ts` defines the optional Phaser multiplier `1.75` and player combat model. Reuse the numeric multiplier only if approved; do not share Phaser outcome labels or client HP authority.

## 10. M0 acceptance checklist

- [x] Product journey, cooperative win condition and exact terminal copy documented.
- [x] Recommended balance values, deterministic sample calculations, rate/memory bounds and deadline ordering documented without claiming tests/tuning.
- [x] New server battle state and reconciler kept distinct from Phaser state and `ForgeStateReconciler`.
- [x] Privacy migration explicitly required in M1 and independently reviewed before M2.
- [x] Mock/Twitch owner authorization and proposed API/error contracts documented; OBS is read-only; no public damage route.
- [x] Strict Generic profile and bounded separate M1/M2 PR handoff documented.
- [x] November 3 deadline, fallback and release gates preserved.
- [ ] Owner approves/revises listed balance and UX decisions.
- [ ] Independent exact-head M0 audit passes.
- [ ] Owner separately authorizes M1; no implementation begins before that authorization.
