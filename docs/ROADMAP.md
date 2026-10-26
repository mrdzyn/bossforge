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

**P3-B live integration remains gated** on Twitch developer account registration/2FA recovery and a separate owner approval. Then implement server-side OAuth and a minimum-scope user-token EventSub WebSocket subscription, verify genuine chat delivery and revocation/reconnect, and explicitly migrate the current mock-only state/event contracts. Never represent synthetic events as live Twitch.

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
