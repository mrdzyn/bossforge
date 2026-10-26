# Project status

- **Active milestone:** Phase 3-B — locally hosted authenticated Twitch OAuth, EventSub and genuine chat-to-boss voting. **Owner authorized implementation; this kickoff contains documentation only.** Real Twitch connectivity has **not yet been tested**.
- **Main baseline:** `5adbd71f5378666e17b805617f37c3bb000505b8`, Phase 3-A approved and squash-merged via [PR #4](https://github.com/mrdzyn/bossforge/pull/4).
- **Phases 0–2:** Completed and independently reviewed, squash-merged via PRs #1, #2 and #3. P2 delivered local Phaser boss battle with four specials and playable rematch.
- **Phase 3-A:** Official-shaped offline `channel.chat.message` normalizer and injected EventSub session lifecycle; independent C2 PASS [review #6421367210](https://github.com/mrdzyn/bossforge/pull/4#issuecomment-6421367210). Codex-reported baseline: **92 tests** (23 shared, 69 server). Both are offline, not yet wired into the application.
- **Phase 3-B authorization:** Owner confirmed Twitch developer app registration is available, supplied a Client ID privately, and explicitly approved starting real integration on a **new Draft PR** with **no merge or deployment**.
- **Active P3-B spec:** [P3B-LIVE-TWITCH-INTEGRATION.md](P3B-LIVE-TWITCH-INTEGRATION.md). Base branch `feat/phase3b-live-twitch-integration`, branch starts at merged P3-A main.
- **Registered/intended OAuth callback:** `http://localhost:3001/auth/twitch/callback`. Confirm exact value in Twitch console and local listener before trying to authorize. Keep Client ID environment-configurable and Client Secret/private tokens out of code, PRs and chat.
- **Planned sequence:** B1 secure local OAuth; B2 verified user-token EventSub WebSocket subscription; B3 explicit mock/Twitch provider contract migration and real voting; B4 test with owner-authorized real Twitch channel and end-to-end gameplay.
- **Current truthful behavior:** Existing runtime remains local simulation only (`simulated:true`, `connectedToTwitch:false`, mock `ForgeSession`). **No real OAuth, subscriptions, Twitch ballots or live browser QA performed by this docs-only kickoff.**
- **Review/merge gates:** Keep the P3-B PR Draft and unmerged. Require independent exact-head review, manual secure local OAuth consent, and separate owner approval before merge. No public binding, deployment, release or Phase 4.

## Acceptance target

A verified local Twitch broadcaster logs in securely; server-side EventSub receives genuine `!vote` chat commands; four timed categories assemble the same boss; the streamer fights it in Phaser; dashboard and OBS accurately distinguish real Twitch versus synthetic mode; revocation, disconnect and authorization failure fail closed. Preserve all 92 existing tests, local-only security and synthetic demo.

## Canonical documents

- [P3-B active specification](P3B-LIVE-TWITCH-INTEGRATION.md)
- [P3-A implementation background](P3-TWITCH-INTEGRATION-READINESS.md)
- [Security](SECURITY.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Acceptance evidence](ACCEPTANCE.md)
- [Handoffs](HANDOFFS.md)
