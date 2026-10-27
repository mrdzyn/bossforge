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

**P3-B implementation and owner-supplied live QA:** On Draft PR #5, the owner reports OAuth/EventSub PASS, one valid welcome, one enabled Helix subscription, 11 keepalives at a 30-second advertised timeout, 6 accepted/normalized notifications and 6 chat callbacks. Three genuine ballots were accepted and three rejected (wrong-category: 1; invalid-choice: 2); no disconnects, socket closes/errors, or forge cancellations occurred. All four stages completed, revealing Cinder Granite (Golem / Fire / Ember Burst default / Earth), and the Phaser arena ended in VICTORY (boss 0/120 HP, streamer 64/100 HP). These live results are owner-supplied and not independently reproduced. Special used its no-vote default, so successful genuine votes in all categories are not claimed. Actual OBS application capture remains UNVERIFIED. Automated fake-network validation is separate: 124 tests passed at implementation commit `279ff63fc803921310226d9c6903a029af7f0bd5`. Keep the PR Draft and unmerged; no deployment/release is authorized. See [active P3-B spec](P3B-LIVE-TWITCH-INTEGRATION.md) and [acceptance evidence](ACCEPTANCE.md#p3-b4-c5-r2--eventsub-keepalive-remediation).

## Phase 4 — Streamer UX and OBS Integration

Complete streamer controls, broadcast presentation, safe margins, responsive
dashboard behavior, and live stream testing.

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
