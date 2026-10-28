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

**Completed and squash-merged via PR #3.** The local Phaser 3 arena includes movement, dodging, four special patterns, weakness combat, victory/defeat and rematch. See [P2 specification](P2-PLAYABLE-BOSS-BATTLE.md). No genuine Twitch connection or remote multiplayer is implemented.

## Phase 3 — Real Twitch Integration

**P3-A offline readiness is authorized.** Implement an official-shaped, fixture-only EventSub chat message normalizer and deterministic WebSocket session/reconnect test harness, without making real Twitch requests or changing the mock-only forge. See [P3 readiness and gates](P3-TWITCH-INTEGRATION-READINESS.md).

**P3-A completed and squash-merged** via PR #4; offline EventSub fixtures/harness are available.

**P3-B implementation and owner-supplied live QA — completed and squash-merged** via PR #5 at `76a5dde`. The owner reports OAuth/EventSub PASS, one valid welcome, one enabled Helix subscription, 11 keepalives at a 30-second advertised timeout, 6 accepted/normalized notifications and 6 chat callbacks. Three genuine ballots were accepted and three rejected (wrong-category: 1; invalid-choice: 2); no disconnects, socket closes/errors, or forge cancellations occurred. All four stages completed, revealing Cinder Granite (Golem / Fire / Ember Burst default / Earth), and the Phaser arena ended in VICTORY (boss 0/120 HP, streamer 64/100 HP). These live results are owner-supplied and not independently reproduced. Special used its no-vote default, so successful genuine votes in all categories are not claimed. Actual OBS application capture remains UNVERIFIED. Automated fake-network validation is separate: 124 tests passed at implementation commit `279ff63fc803921310226d9c6903a029af7f0bd5`. See [active P3-B spec](P3B-LIVE-TWITCH-INTEGRATION.md) and [acceptance evidence](ACCEPTANCE.md#p3-b4-c5-r2--eventsub-keepalive-remediation).

## Phase 4 — Streamer UX and OBS Integration

**Phase 4-A — Streamer voting UX and OBS readiness** is in progress on
`feat/p4a-streamer-voting-ux` in separate Draft PR #6. It adds active-stage
command guidance, countdowns, vote attribution and stale-state-safe overlay
presentation. C2 mobile clipping work is on that PR; it must be reviewed and
decided independently of this planning PR. See
[Phase 4-A readiness](P4A-STREAMER-OBS-READINESS.md).

## Proposed product direction — PDCP-001

The proposal changes BossForge's primary experience to a game-agnostic Twitch
engagement overlay: chat creates a boss, chat fights it through server-validated
commands, and the streamer keeps playing their game. “Game-agnostic” means the
OBS Browser Source runs alongside a game; it does not read, detect, control, or
integrate with arbitrary games. The existing real Twitch and mock forge paths
remain. A new server-authoritative battle session is proposed independently of
the optional Phaser arena, which remains a self-contained demo and receives no
further gameplay expansion.

PDCP-001 defines proposed milestones M0–M5, contracts, profile boundaries,
security, acceptance and schedule-slip fallbacks in
[the product-direction specification](PDCP-001-ANY-GAME-TWITCH-ENGAGEMENT.md).
This is a planning-only proposal on a separate documentation PR. It does not
authorize implementation or alter active Phase 4-A PR #6. The owner must decide
the current PR #6 and explicitly authorize each subsequent implementation
scope. Challenges and the Arena profile are optional; the Generic profile and
a correctly labeled real Twitch demo take priority. No merge, deployment,
publication, or Phase 5 submission is authorized by the proposal.

## Phase 5 — Hackathon Submission

Prepare the verified Twitch demonstration, short public YouTube demo, written
submission description, source-code verification, and Codex development
evidence.

## Priorities and fallback

Prioritize genuine Twitch-connected audience voting, one meaningful modular
boss mechanic, a playable battle loop, and an OBS-compatible overlay. If time is
short, prefer one reproducible complete round over a broad unfinished feature
set. AI voice, procedural music, multiplayer combat, payments, leaderboards,
subscriptions, and account databases remain deferred.
