# M0 — Any-Game Twitch Engagement Contract Lock

**Status:** Documentation-only contract proposal on `docs/m0-any-game-contract-lock`, based on `main` at `5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`. No M1/M2 implementation is authorized by this document.
**Product promise:** **Chat creates the boss. Chat fights the boss. The streamer keeps playing their game.**
**Current truth:** The shipped product is the four-stage forge, local verified Twitch voting path, and optional Phaser arena. Privacy-safe browser projections, `!hit` combat, server-authoritative battle HP, and Generic/Arena profile loading are not implemented.

## 1. Locked experience and boundaries

1. The streamer opens the local dashboard, selects the Generic experience, connects the existing Twitch integration through its owner-controlled flow, and adds the read-only `/overlay` Browser Source to OBS. Mock mode is credential-free and clearly labeled **SIMULATED**.
2. Viewers create a boss through the existing `body`, `element`, `special`, and `weakness` forge stages. Existing P4A commands remain exactly `!vote <category> <choice>` for the active category; existing live commands still require verified Twitch connection and fresh authoritative state.
3. In the final experience, a valid forge reveal will bind an immutable boss/profile/forge-cycle snapshot and enter server-authoritative `ready` (**BATTLE READY**), introduced in M2-A. The earlier M1-B milestone is presentation-only: it shows the freshly revealed boss with **BATTLE COMING SOON**, without an inferred battle state, timer, HP, or hits.
4. After M2-A provides authoritative `ready`, the streamer explicitly clicks **Start Battle** in the authenticated local dashboard. The server changes `ready` to `active`, records the start/deadline and begins the timer. M1-B has no Start Battle control.
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

These are proposed M0 values and paper calculations only. They are not tested tuning or claims of live fairness. Every duration/band combination below is supported; HP is selected from the profile matrix at Start Battle and remains immutable through that encounter. Never derive or change HP from live Twitch viewer counts.

| Parameter            | Recommended starting value                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Encounter duration   | Owner chooses 60, 90, or 120 seconds; 90 seconds is the suggested UI default.                                          |
| Base attack          | `!hit` applies 8 integer damage.                                                                                       |
| Weakness attack      | `!hit <weakness>` applies 14 damage only when the supplied recognized element matches the disclosed weakness.          |
| Rounding             | Positive integer round-half-up: `floor((baseDamage * 7 + 2) / 4)`; base 8 yields exactly 14.                           |
| Per-hit maximum      | 14 damage; HP clamps at zero.                                                                                          |
| Per-viewer cooldown  | 2,000 ms monotonic time per encounter; starts only after an accepted hit.                                              |
| Accepted-hit limiter | Token bucket at 8 accepted hits/second, burst 16.                                                                      |
| Queue                | At most 64 commands and 500 ms maximum queue age; overflow/expired items are rejected without HP or cooldown mutation. |

### Recommended duration-and-band HP matrix

The streamer selects an expected audience band and duration before starting. The profile fixes the resulting `maxHp` when the server accepts Start Battle.

| Expected active attackers (owner-selected band) | 60 seconds | 90 seconds | 120 seconds |
| ----------------------------------------------- | ---------: | ---------: | ----------: |
| `low` (1–3)                                     |     100 HP |     150 HP |      200 HP |
| `medium` (4–10)                                 |     400 HP |     550 HP |      750 HP |
| `high` (11–30+)                                 |   1,000 HP |   1,500 HP |    2,000 HP |

These proposed values are chosen so the minimum cohort in each band can win under the realistic sample schedule below, while HP remains bounded and fixed at battle start. Larger participation can win earlier. The band is an owner-selected expectation, not a viewer count, estimate, or API read; high-band HP caps at 2,000 even if more viewers appear.

### Reachability analysis — perfect weakness cadence upper bound

For duration `T`, each viewer can submit at most `T / 2` accepted-cooldown opportunities when the first hit arrives at `t=0` and subsequent hits are exactly two seconds apart. The global token-bucket ceiling is `16 + 8T` hits over `[0,T)`. Therefore the theoretical all-weakness damage upper bound is `14 × min(N × T/2, 16 + 8T)`. This is an upper bound: synchronized bursts, the 64-entry queue, or the 500 ms queue-age limit can lower delivery. The 30-attacker maximum-cadence case offers 15 messages/second against an 8/second sustained limiter, so it must not be treated as a guaranteed realized total.

| Attackers | 60s max damage | 90s max damage | 120s max damage |
| --------: | -------------: | -------------: | --------------: |
|         1 |            420 |            630 |             840 |
|         3 |          1,260 |          1,890 |           2,520 |
|         4 |          1,680 |          2,520 |           3,360 |
|        10 |          4,200 |          6,300 |           8,400 |
|        11 |          4,620 |          6,930 |           9,240 |
|        30 |         6,944* |        10,304* |         13,664* |

`*` The value is capped by the theoretical burst-plus-refill token budget (496, 736, and 976 accepted hits respectively) before queue-age losses. It is not a promise that saturated arrivals can realize the cap. For the recommended HP matrix, every displayed upper bound exceeds its band HP; the table establishes mathematical headroom, not expected viewer behavior.

### Reachability analysis — paced sample, one-third weakness matches

Assume each viewer sends one command every five seconds, beginning at `t=0`, with every third command matching the disclosed weakness and the other two dealing base damage. Stagger viewers evenly across each five-second interval instead of sending simultaneous bursts. This yields 12/18/24 commands per viewer in 60/90/120 seconds, respectively, with average damage 10 per command. At 30 viewers the paced arrival rate is 6/second, below the 8/second accepted-hit refill rate; queue capacity and age do not bind in this schedule. This is an illustrative workload, not a measured or tested prediction.

Each cell is `sample damage / recommended HP for the matching band`.

| Attackers and selected band |    60 seconds |    90 seconds |   120 seconds |
| --------------------------- | ------------: | ------------: | ------------: |
| 1 — low                     |     120 / 100 |     180 / 150 |     240 / 200 |
| 3 — low                     |     360 / 100 |     540 / 150 |     720 / 200 |
| 4 — medium                  |     480 / 400 |     720 / 550 |     960 / 750 |
| 10 — medium                 |   1,200 / 400 |   1,800 / 550 |   2,400 / 750 |
| 11 — high                   | 1,320 / 1,000 | 1,980 / 1,500 | 2,640 / 2,000 |
| 30 — high                   | 3,600 / 1,000 | 5,400 / 1,500 | 7,200 / 2,000 |

Under this paced sample, the minimum cohort in each band exceeds the proposed HP by 20% or more at all three durations, so a Community Victory is plausible before the deadline if that activity continues. That is a design target, not a win guarantee. Missed commands, chat delivery, queue contention, cooldown timing, or fewer active participants can cause **BOSS SURVIVED**. The perfect-cadence table is a theoretical ceiling; this sample is a stated cadence; neither has been simulated or tuned.

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
    "audienceHpByDuration": {
      "60": { "low": 100, "medium": 400, "high": 1000 },
      "90": { "low": 150, "medium": 550, "high": 1500 },
      "120": { "low": 200, "medium": 750, "high": 2000 }
    },
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

| Scope                                           | Bounded deliverable                                                                                                                                                                                                                                                    | Exit criteria                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1-A — Privacy-safe outbound projections**    | Keep `NormalizedChatEvent` internal; replace universal raw EventHub broadcast with strict versioned recipient-specific dashboard/overlay projections, safe aggregate activity, and privacy-safe snapshots/diagnostics/logs.                                            | Sentinel IDs/names/message IDs/text/tokens/secrets/full errors are absent from serialized dashboard and OBS frames, HTTP snapshots, diagnostics and logs in mock/Twitch-shaped valid/rejected/disconnect/reconnect/restart tests. Strict schemas reject `chat.event` and unknown sensitive keys. Independent security review PASS. **Hard blocker for M2.** |
| **M1-B — Generic OBS and dashboard states**     | Privacy-safe Generic mode labels and read-only overlay states; render the freshly revealed boss from authoritative ForgeState with the presentation-only copy **REVEALED — BATTLE COMING SOON**. No BattleState, BATTLE READY, HP/timer, Start Battle, or chat damage. | Fresh ForgeState only; no inferred battle authority or stale content; Generic works without Phaser; mock stays credential-free; live/simulated/disconnected labels remain accurate and stale-state suppression remains. Must consume M1-A projections; no private-event bypass.                                                                             |
| **M2-A — Server battle engine/contracts**       | Introduce strict `CommunityBattleStateV1`, Generic v1 schema, `BossBattleSession`, authoritative reveal-to-`ready`, owner Start Battle, explicit transitions, revision/epoch, HP, deadline, cancellation, idempotency and battle reconciler. No chat hit routing.      | Fake-clock tests for all transitions, monotonic revisions, deadline ordering, terminal immutability, duplicate start, restart epoch and stale HTTP/WS frames. No chat ingress until privacy M1-A review gate passes.                                                                                                                                        |
| **M2-B — Chat command routing and rate limits** | Internal Twitch/mock `!hit` parser/router, source isolation, weakness rules, dedup/cooldown, global rate/queue/memory bounds and aggregate diagnostics.                                                                                                                | Fake EventSub/session tests prove only validated source reaches active battle, no public damage route, no cross-provider/replay/late hit, exact caps, fixed rejection reasons and zero identity outbound. **No genuine live-hit claim before M1-A + M2-A/B audits.**                                                                                        |
| **M2-C — OBS battle UI and full integration**   | Compose privacy-safe forge/battle snapshots and aggregate events in dashboard and read-only Generic overlay; status, HP, weak point, timer, outcome copy and instruction display.                                                                                      | Dashboard/overlay reconnect and epoch tests; responsive Chromium; no admin controls or stale state. Owner OBS application evidence is separate from Chromium QA.                                                                                                                                                                                            |
| **M2-D — Deterministic tests and owner QA**     | Integrate test matrix, simulation, abuse/recovery checks, acceptance docs and controlled owner QA plan. This scope coordinates evidence; it cannot claim a pass from fixtures.                                                                                         | Full repository gates and synthetic 4-stage-to-battle acceptance; independent exact-head security review; then owner-controlled real Twitch authorization and genuine chat test, separately recorded. Only verified owner live evidence plus review permits live feature claims.                                                                            |

**M1 gates that block M2:** M1-A schema/recipient segregation merged and exact-head independently security-reviewed; sentinel absence proven in both dashboard and OBS serialization, snapshots, diagnostics and logs; dashboard aggregate usefulness retained; strict rejection of raw `chat.event`; existing P4A freshness/privacy/security controls unchanged. M1-B is presentation-only and cannot create a battle state, Start Battle action, HP/timer, or parallel raw-event path. M2-A introduces authoritative `CommunityBattleStateV1` and `ready`; M2-B alone adds chat hit routing.

**M2 gates that block live claims:** M2-A/B/C/D deterministic tests and full repo gates pass; exact-head independent review approves attack authority, balancing, abuse caps, replay/cooldown, session/provider separation, cancellation, reconciliation and privacy; no genuine vote is inferred from mocks; owner personally performs Twitch consent and real chat testing; OBS application evidence is labeled owner-supplied unless independently reproduced. No automatic reconnect resume or fake vote may be claimed.

## 7. Decisions requiring owner approval before implementation

1. Approve/revise damage `8`, multiplier `7/4`, 2-second accepted-hit cooldown, the duration-by-band HP matrix (low 100/150/200; medium 400/550/750; high 1,000/1,500/2,000 for 60/90/120 seconds), 8/s global accepted-hit rate, burst 16, queue 64/500 ms, 10-minute/10,000-entry dedup, and 5,000 cooldown entries. These are paper-derived starting proposals, not tested balance.
2. Choose the initial audience-band UX/default. Recommendation: require the owner to choose `low`/`medium`/`high` and duration before M2-A Start Battle; if a default is required, use `medium` and visibly allow `low` for a small chat. Never infer the band from current Twitch viewer count.
3. Confirm semantics for a recognized but nonmatching element argument. Recommendation: accept it as base 8 damage, no multiplier; unknown words are rejected. A stricter alternative is to reject every wrong element. Decide before M2-B.
4. Confirm whether attack counters expose separate base/weakness counts on OBS or only total accepted attacks. Recommendation: OBS displays aggregate total and HP only; dashboard may show safe aggregate base/weakness/rejection counters.
5. Approve M1-A as mandatory pre-M2 work. It closes an existing privacy exposure; it is not a claim that current browser events are safe.

Until these decisions and the M0 exit audit are accepted, M1/M2 implementation remains unauthorized. The M1-B presentation preview has no battle engine; authoritative BATTLE READY and Start Battle begin in M2-A.

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
- [x] Duration-by-band HP recommendations, six-cohort reachability tables, deterministic sample cadence, limiter/queue caveats and deadline ordering documented as paper analysis, without claiming simulations or tuned balance.
- [x] New server battle state and reconciler kept distinct from Phaser state and `ForgeStateReconciler`.
- [x] Privacy migration explicitly required in M1 and independently reviewed before M2.
- [x] Mock/Twitch owner authorization and proposed API/error contracts documented; OBS is read-only; no public damage route.
- [x] Strict Generic profile and bounded M1/M2 PR handoff documented; M1-B preview is presentation-only and M2-A owns authoritative battle state/start.
- [x] November 3 deadline, fallback and release gates preserved.
- [ ] Owner approves/revises listed balance and UX decisions.
- [ ] Independent exact-head M0 audit passes.
- [ ] Owner separately authorizes M1; no implementation begins before that authorization.
