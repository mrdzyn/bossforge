# Project status

- **Active milestone:** P3-A — offline Twitch EventSub fixture normalization and injected lifecycle harness. This slice does not connect to Twitch, use credentials, or enable live voting.
- **Phase 0:** Completed and squash-merged via [PR #1](https://github.com/mrdzyn/bossforge/pull/1).
- **Phase 1:** Completed, independently source-reviewed through C6 and squash-merged via [PR #2](https://github.com/mrdzyn/bossforge/pull/2) to `main` at `2ca5c1ebcd0fe4f51b153faf36a8a765d66fec45`.
- **Phase 2:** Completed, independently source-reviewed through C2 ([P2-C2 PASS](https://github.com/mrdzyn/bossforge/pull/3#issuecomment-6419685792)), and squash-merged via [PR #3](https://github.com/mrdzyn/bossforge/pull/3) to `main` at `7aa90c96133bfbc44f1809f5e89bb5c75fb892ce`. Final Codex-reported P2 suite: 62 tests (23 shared, 39 server); independent reviewer did not rerun commands.
- **P3-A authorization:** Owner requested the next milestone on the existing `feat/phase3-twitch-readiness` branch and Draft PR #4. P3-A implementation adds an offline official-shaped EventSub normalizer and dependency-injected lifecycle harness only; the live mock-only ForgeSession remains unchanged.
- **P3-B NOT authorized:** Genuine OAuth, credential acquisition, EventSub subscription, and Twitch-connected forge integration remain blocked by Twitch developer registration requiring 2FA; explicit separate owner approval is required after account recovery.
- **Active spec:** [P3 Twitch Integration Readiness](P3-TWITCH-INTEGRATION-READINESS.md). Preferred future transport is server-side EventSub WebSocket with user access token and minimum read-only chat scope, subject to current official Twitch requirements.
- **Security/UX:** Current forge remains 100% local simulation; `ForgeSession` still accepts mock events only and the forge schema explicitly says `simulated: true`, `connectedToTwitch: false`. P3-A may not weaken those checks or claim real Twitch integration.
- **Merge/deployment:** No P3 merge, production deployment, release or publishing is authorized. Require independent exact-head review and explicit owner merge decision.

## Current milestone acceptance

A testable offline EventSub chat normalizer and connection lifecycle harness that fail closed on malformed/duplicate/wrong-channel events, keep tokens out of the project, make **zero real Twitch network calls**, preserve all Phase 0–2 behavior, and supply a separately gated live OAuth/EventSub activation plan. Run frozen install, build, typecheck, lint, format, full tests, mock simulation and diff check after Codex implementation. Real Twitch connectivity remains **NOT TESTED**, never PASS.

## Canonical references

- [P3-A spec and future P3-B gates](P3-TWITCH-INTEGRATION-READINESS.md)
- [Project roadmap](ROADMAP.md)
- [Security boundaries](SECURITY.md)
- [Architecture](ARCHITECTURE.md)
- [Acceptance history](ACCEPTANCE.md)
- [Handoffs](HANDOFFS.md)
