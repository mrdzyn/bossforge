# Project status

- **Active milestone:** Phase 0 — Repository Foundation and Architecture
- **Current state:** Phase 0 C1 remediation is implemented and validated in the
  local `feat/phase0-foundation` checkout and is being prepared for push to
  Draft PR [#1](https://github.com/mrdzyn/bossforge/pull/1). PR #1 exists and was
  created through the owner's connected GitHub account. Request C2 independent
  review after the remediation head is pushed.
- **Twitch status:** No real Twitch authentication or EventSub connection is
  implemented or claimed. The owner-reported Twitch two-factor setup issue
  remains an external blocker for the later real integration phase.

## Scope in this milestone

Phase 0 provides the TypeScript/pnpm workspace, shared runtime contracts, a
Fastify health endpoint and WebSocket event stream, a deterministic local mock
chat adapter, a streamer dashboard shell, and an OBS-oriented overlay preview.
Voting, procedural boss assembly, and playable combat remain planned work.

## Current validation

The C1 remediation adds local-origin WebSocket restrictions, loopback-only
development simulation controls, and mock-provider enforcement. Frozen install,
production build, strict TypeScript checks, ESLint, formatting, and all tests
passed against this head; see [ACCEPTANCE.md](ACCEPTANCE.md) for exact results.
Chromium QA ran at the requested dashboard and overlay sizes; screenshots and
observations are in `docs/visual-qa/`. Do not treat placeholder UI or simulation
output as real gameplay or Twitch connectivity.

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

Push the validated remediation to Draft PR #1 and request a C2 independent
review of that pushed head. Do not start Phase 1 without separate owner
authorization.
