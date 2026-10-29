# Roadmap

## Phase 0 — Repository Foundation and Architecture

Establish the workspace, server/web/shared boundaries, validated contracts,
local mock chat path, dashboard and overlay shell, and implementation
documentation. Phase 0 is complete and was squash-merged via PR #1.

## Phase 1 — Audience Voting and Boss Assembly

Implement timed audience voting, one mutable vote per viewer/category, final
results, modular boss assembly, streamer controls, OBS voting presentation, and
a repeatable local synthetic-chat workflow. P1 does not include playable combat
or Twitch authentication.

## Phase 2 — Playable Boss Battle

**Completed and squash-merged via PR #3.** The local Phaser 3 arena includes
movement, dodging, four special patterns, weakness combat, victory/defeat and
rematch. See [P2 specification](P2-PLAYABLE-BOSS-BATTLE.md). No genuine Twitch
connection or remote multiplayer is implemented.

## Phase 3 — Real Twitch Integration

**P3-A** completed and squash-merged via PR #4; offline EventSub fixtures and
the deterministic lifecycle harness are available.

**P3-B** completed and squash-merged via PR #5 at `76a5dde`. The owner reports
OAuth/EventSub PASS, one valid welcome, one enabled Helix subscription, 11
keepalives at a 30-second advertised timeout, 6 accepted and normalized
notifications, and 6 chat callbacks. Three genuine ballots were accepted and
three rejected (one wrong-category, two invalid-choice); no disconnects, socket
closes/errors, or forge cancellations occurred. All four stages completed,
revealing Cinder Granite (Golem / Fire / Ember Burst default / Earth); Special
used its no-vote default, so successful genuine votes in all categories are not
claimed. The Phaser arena ended in VICTORY (boss 0/120 HP, streamer 64/100 HP).
These live results are owner-supplied and not independently reproduced. The
P3-B live run did not include OBS capture. Separate P4A owner-supplied visual QA
in the actual OBS Studio application passed at 1920×1080 and 1280×720 in
simulated mode; it does not establish new real Twitch voting, live HP
synchronization, or continuous animation performance. Automated fake-network
validation is separate: 124 tests passed at implementation commit
`279ff63fc803921310226d9c6903a029af7f0bd5`. See the [P3-B specification](P3B-LIVE-TWITCH-INTEGRATION.md) and [acceptance evidence](ACCEPTANCE.md#p3-b4-c5-r2--eventsub-keepalive-remediation).

## Phase 4 — Streamer UX and OBS Integration

**Phase 4-A — Streamer Voting UX and OBS Readiness** is complete and
accepted on `main` through PR #6, squash-merged in the current baseline
`5655dea53e3eba5425b6ead8926659a0bb72ae5e`. The dashboard and read-only OBS
overlay provide exact active-stage `!vote <category> <choice>` instructions,
countdowns, tie-aware totals, community/default attribution, live/simulated/
disconnected labels, and fresh-state safeguards. The mobile clipping remediation
and responsive Chromium QA passed. Owner-supplied actual OBS Studio visual QA
passed at 1920×1080 and native 1280×720 with Fit to Screen; it was not
independently reproduced and is not evidence of live battle HP or animation
performance. The 149-test result (29 shared, 19 web, 101 server) is historical
automated evidence from the P4A-C2 implementation checkpoint, separate from
synthetic simulation, Chromium evidence, owner OBS results, and historical live
Twitch evidence. Details are preserved in [P4A readiness](P4A-STREAMER-OBS-READINESS.md) and [acceptance](ACCEPTANCE.md).

## Proposed product direction — PDCP-001

PDCP-001 proposes making BossForge primarily a game-agnostic Twitch engagement
overlay: chat creates the boss, chat fights it through server-validated
commands, and the streamer keeps playing their game. “Game-agnostic” means the
OBS Browser Source runs alongside a game; it does not read, detect, control, or
integrate with arbitrary games. Existing verified Twitch and mock forge paths
remain. The proposed server-authoritative battle session is independent of the
optional Phaser arena, which remains a self-contained demo with no further
gameplay expansion.

PDCP-001 is approved for planning and merged through PR #7 at
`5b30d7b3139c9f1ab74f3be46d0f4fb5d9665865`; its prior exact-head audit passed
at [`adfaa6f`](https://github.com/mrdzyn/bossforge/pull/7#issuecomment-6461839234).
M1-A privacy-safe outbound events were squash-merged through PR #9 at
`bacaf6b338a75b9fcb8a9ee22a62aee4364bca96`; raw normalized chat remains
server-internal, with strict recipient-specific dashboard/OBS projections and
sentinel regression tests. M1-B is separately authorized as presentation-only. `!hit` combat, authoritative battle HP,
and Generic/Arena profile loading remain unimplemented. The bounded
[M0 contract lock](M0-ANY-GAME-CONTRACT-LOCK.md) specifies proposed state,
privacy, duration-by-band balance, authorization, and delivery contracts. M1-B
is a presentation-only revealed-boss / “BATTLE COMING SOON” preview from fresh
ForgeState; it has no battle state or Start Battle. M2-A introduces authoritative
`CommunityBattleStateV1`, BATTLE READY and owner Start Battle; M2-B adds chat hit
routing. The contract defines later M1/M2 boundaries; current M1-B authorization does not authorize M2. The PDCP-001 schedule and November 3, 2026 06:00
Asia/Manila deadline remain; prioritize Generic OBS and a genuine server-
authoritative Twitch attack over optional challenges, Arena profile polish,
extra themes, and effects. Every implementation scope needs separate owner
authorization and independent review.

## Phase 5 — Hackathon Submission

Submission is not authorized or started. The plan reserves time for owner-run
Twitch validation, OBS recording, a public YouTube demo, Codex session evidence,
and Devpost preparation/submission by the November 3, 2026 deadline. Each
external action requires separate owner authorization. Do not fabricate
evidence or a Codex session ID.

## Priorities and fallback

Preserve a usable Generic OBS experience, the real Twitch forge demonstration,
and a credential-free mock path. If time slips, defer optional challenges and
the Arena profile first. Do not substitute mock activity or Phaser client-side
damage for proof of genuine server-authoritative Twitch combat. AI voice,
procedural music, multiplayer combat, payments, leaderboards, subscriptions,
accounts and cloud hosting remain deferred.
