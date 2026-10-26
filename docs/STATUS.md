# Project status

- **Active milestone:** Phase 0 — Repository Foundation and Architecture
- **Current state:** Phase 0 C3-01 bounded remediation is validated and pushed
  to `feat/phase0-foundation` on Draft PR
  [#1](https://github.com/mrdzyn/bossforge/pull/1). PR #1 remains Draft. The
  branch is ready for C4 independent review.
- **Twitch status:** No real Twitch authentication or EventSub connection is
  implemented or claimed. The owner-reported Twitch two-factor setup issue
  remains an external blocker for the later real integration phase.

## Scope in this milestone

Phase 0 provides the TypeScript/pnpm workspace, shared runtime contracts, a
Fastify health endpoint and WebSocket event stream, a deterministic local mock
chat adapter, a streamer dashboard shell, and an OBS-oriented overlay preview.
Voting, procedural boss assembly, and playable combat remain planned work.

## Current validation

The C1 and C2 protections remain in place. C3-01 validates Vite's final
resolved development host after CLI options are merged and before bind, so
`--host 0.0.0.0` fails closed. The process test verifies startup failure and
that no listener remains. Simulation POST Origin and Fetch Metadata checks
still preserve local dashboard and originless loopback CLI requests. The
reported browser 404 is fixed; current checks and the settled feed screenshot
are recorded in [ACCEPTANCE.md](ACCEPTANCE.md).

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

Provide the exact pushed branch head on Draft PR #1 for C4 independent review.
Do not start Phase 1 without separate owner authorization.
