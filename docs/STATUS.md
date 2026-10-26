# Project status

- **Active milestone:** Phase 0 — Repository Foundation and Architecture
- **Current state:** Phase 0 C2-01 bounded remediation for Draft PR
  [#1](https://github.com/mrdzyn/bossforge/pull/1) is implemented and validated,
  ready to push to `feat/phase0-foundation`. PR #1 was created through the
  owner's connected GitHub account and remains Draft.
- **Twitch status:** No real Twitch authentication or EventSub connection is
  implemented or claimed. The owner-reported Twitch two-factor setup issue
  remains an external blocker for the later real integration phase.

## Scope in this milestone

Phase 0 provides the TypeScript/pnpm workspace, shared runtime contracts, a
Fastify health endpoint and WebSocket event stream, a deterministic local mock
chat adapter, a streamer dashboard shell, and an OBS-oriented overlay preview.
Voting, procedural boss assembly, and playable combat remain planned work.

## Current validation

The C1 protections remain in place. C2-01 now also fails Vite startup for
non-loopback `VITE_HOST` values and checks simulation POST Origin and Fetch
Metadata while preserving originless loopback CLI calls. The reported browser
404 was traced to `/favicon.ico`; the app now serves an SVG favicon, and a fresh
Chromium load completed without resource errors. A settled feed screenshot and
results are recorded in [ACCEPTANCE.md](ACCEPTANCE.md).

## Known limitations

- The mock sequence uses synthetic viewer data and is not evidence of Twitch
  authorization or a live Twitch message.
- Dashboard and overlay surfaces are presentation shells; voting and battle
  controls are not functional gameplay.
- Production WebSocket access still needs authentication and appropriate event
  authorization before any production use. Phase 0 does not implement either.
- An earlier `gh pr create` attempt failed due to GitHub API access, but Draft
  PR #1 now exists through the owner's connected GitHub account. That historical
  failure is retained in [HANDOFFS.md](HANDOFFS.md); PR creation is not blocked.
- Merge remains owner-controlled.

## Next handoff

After validation and push, request a C3 independent review of the exact branch
head on Draft PR #1. Do not start Phase 1 without separate owner authorization.
