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

**Authorized kickoff on the Phase 1 merged baseline.** Implement a compact Phaser 3 arena with streamer movement, telegraphed boss attack patterns, health, meaningful weakness mechanics, and a complete victory/defeat/rematch cycle. See [the active P2 specification](P2-PLAYABLE-BOSS-BATTLE.md). Local mock-only combat; no Twitch authentication, production deployment, or remote multiplayer.

## Phase 3 — Real Twitch Integration

After Twitch developer registration is unblocked and the owner authorizes the
work, use server-side OAuth and official EventSub APIs with minimum permissions.
Verify authorization, chat delivery, reconnect behavior, and permission
revocation. Never represent the local mock path as this integration.

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
