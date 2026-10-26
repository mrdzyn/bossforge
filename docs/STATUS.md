# Project status

- **Active milestone:** Phase 3-B — locally hosted authenticated Twitch OAuth, EventSub and genuine chat-to-boss voting. Owner-authorized B1–B3 implementation is on the existing Draft PR #5 branch. Real Twitch connectivity has **not yet been tested**; the local environment configuration draft is awaiting owner review/publish, and real account consent remains an owner action.
- **Main baseline:** `5adbd71f5378666e17b805617f37c3bb000505b8`, Phase 3-A approved and squash-merged via [PR #4](https://github.com/mrdzyn/bossforge/pull/4).
- **Phases 0–2:** Completed and independently reviewed, squash-merged via PRs #1, #2 and #3. P2 delivered local Phaser boss battle with four specials and playable rematch.
- **Phase 3-A:** Official-shaped `channel.chat.message` normalizer and injected EventSub session lifecycle; independent C2 PASS [review #6421367210](https://github.com/mrdzyn/bossforge/pull/4#issuecomment-6421367210). Codex-reported baseline: **92 tests** (23 shared, 69 server). They remain offline on P3-A `main`; the P3-B branch wires them to injected real transports behind explicit local OAuth.
- **Phase 3-B authorization:** Owner confirmed Twitch developer app registration is available, supplied a Client ID privately, and authorized real local integration on existing Draft PR #5 with **no merge or deployment**. A cloud config draft declares `TWITCH_CLIENT_ID`, `TWITCH_INTEGRATION_ENABLED=false`, a private `TWITCH_CLIENT_SECRET` requirement, and Twitch egress hosts; changes are saved but unapplied pending owner review/publish. No credential values are recorded here.
- **Active P3-B spec:** [P3B-LIVE-TWITCH-INTEGRATION.md](P3B-LIVE-TWITCH-INTEGRATION.md). Base branch `feat/phase3b-live-twitch-integration`, branch starts at merged P3-A main.
- **Registered/intended OAuth callback:** `http://localhost:3001/auth/twitch/callback`. Confirm exact value in Twitch console and local listener before trying to authorize. Keep Client ID environment-configurable and Client Secret/private tokens out of code, PRs and chat.
- **Implementation sequence:** B1 local OAuth, B2 outbound EventSub + Helix, and B3 provider-aware voting/UI are implemented and offline-tested. B4 owner-authorized live Twitch login/channel validation remains NOT TESTED and requires private credentials plus account interaction.
- **Current truthful behavior:** Runtime now supports explicit `mock` and authenticated local `twitch` forge modes. Mock mode remains default. Twitch mode requires OAuth identity validation, owner-bound local control, a welcomed EventSub session and verified Helix subscription before any live chat is forwarded. Only fake-network tests were run; real OAuth, subscription, chat ballots and live Twitch browser QA remain **NOT TESTED**.
- **Review/merge gates:** Keep the P3-B PR Draft and unmerged. Require independent exact-head review, manual secure local OAuth consent, and separate owner approval before merge. No public binding, deployment, release or Phase 4.

## P3-B implementation checkpoint

- **B1:** Added default-disabled confidential-client authorization-code OAuth at the exact local callback. Browser-bound single-use state, HttpOnly/SameSite cookies, exact Host/loopback checks, `user:read:chat` scope, validated numeric identity/client ID, in-memory access/rotating refresh tokens, refresh, hourly validation, revocation, logout and safe error responses are covered with deterministic fake HTTP tests.
- **B2:** Wired the P3-A normalizer/session harness to an outbound WSS transport and Helix `channel.chat.message` v1 subscription. Subscriptions use the authenticated user token and self broadcaster/reader IDs, are verified enabled before forwarding, retry/resubscribe after unexpected disconnect, and stop on revocation. The pending reconnect orphan-socket condition is fixed.
- **B3:** Shared forge state/events now carry explicit provider mode and consistency-checked simulation/connection flags. `ForgeSession` accepts only the active mode; Twitch-mode HTTP controls require the OAuth browser session and exact local Origin/Fetch Metadata; mock injection is disabled in Twitch mode. Dashboard controls and OBS labels remain credential-free and accurately distinguish mock, connected and disconnected states. P2 arena continues to consume the same authoritative boss state.
- **Codex validation:** Workspace test total is 106 (23 shared, 83 server), preserving all 92 P3-A tests. Frozen install, build, typecheck, lint, format check, full suite, `git diff --check`, synthetic simulation and local Chromium regression passed. Exact command outcomes and screenshots are in [ACCEPTANCE](ACCEPTANCE.md).
- **Not tested / owner action:** This environment has no applied Twitch secret configuration. No OAuth consent, Twitch API/WSS request, or live channel vote was attempted. Review and publish the saved environment draft, configure the registered Client ID/secret privately, confirm the exact callback in Twitch console, and personally initiate OAuth before any real integration result can be claimed. Ports 5173 and 3013 were occupied, left untouched; browser QA used loopback ports 5201/3201.
- **Delivery gate:** Existing Draft PR #5 only; no merge/deploy/release. Independent security review is pending for the exact pushed HEAD. Codex tests and browser captures are not approval.

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
