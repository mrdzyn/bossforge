# Project status

- **Active milestone:** P2 — Playable Boss Battle (**kickoff/specification only; combat not yet implemented**).
- **Phase 0:** Completed and squash-merged through [PR #1](https://github.com/mrdzyn/bossforge/pull/1) at `1fc0d8b8f8d3665266a4a5092f6da240bbddf7b1`.
- **Phase 1:** Completed, independently source-reviewed through C6 ([C6 PASS](https://github.com/mrdzyn/bossforge/pull/2#issuecomment-6417403432)), and squash-merged via [PR #2](https://github.com/mrdzyn/bossforge/pull/2) into `main` at `2ca5c1ebcd0fe4f51b153faf36a8a765d66fec45`. The prior 49-test validation was Codex-reported.
- **P2 authorization:** Owner instructed the project to begin Phase 2. Base `main` is the Phase 1 squash merge. Work in `feat/phase2-playable-boss-battle`; current kickoff is **docs/spec only**, not a game implementation or approval.
- **P2 active specification:** [Playable Boss Battle](P2-PLAYABLE-BOSS-BATTLE.md). Next: implement a compact Phaser 3 browser arena using the existing revealed, validated mock-forged boss, with controls, four telegraphed specials, health, weakness, victory/defeat and rematch.
- **Twitch registration blocker:** The owner's account 2FA/mobile verification remains unresolved; actual Twitch OAuth/EventSub is postponed. Simulation must be plainly labeled.
- **Merge/deployment:** No Phase 2 merge, deployment, release or publishing is authorized. Require independent exact-head review and explicit owner merge decision.

## Acceptance target

Complete local demo: simulated four-category forge -> boss reveal -> user starts Phaser arena -> playable boss battle with health and differentiated attack patterns -> streamer/community result -> rematch. Local-only boundaries and prior 49 Phase 1 tests must not regress. Do not claim remote multiplayer, authenticated combat, or genuine Twitch voting.

## Source of truth

- [P2 specification](P2-PLAYABLE-BOSS-BATTLE.md)
- [Architecture](ARCHITECTURE.md)
- [Security controls](SECURITY.md)
- [Acceptance history](ACCEPTANCE.md)
- [Execution handoffs](HANDOFFS.md)
- [Roadmap](ROADMAP.md)
