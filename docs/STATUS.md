# Project status

- **Active milestone:** Phase 0 — Repository Foundation and Architecture
- **Current state:** Phase 0 code and automated checks are complete on
  `feat/phase0-foundation`; repository handoff is pending.
- **Twitch status:** No real Twitch authentication or EventSub connection is
  implemented or claimed. The owner-reported Twitch two-factor setup issue
  remains an external blocker for the later real integration phase.

## Scope in this milestone

Phase 0 provides the TypeScript/pnpm workspace, shared runtime contracts, a
Fastify health endpoint and WebSocket event stream, a deterministic local mock
chat adapter, a streamer dashboard shell, and an OBS-oriented overlay preview.
Voting, procedural boss assembly, and playable combat remain planned work.

## Current validation

Frozen dependency installation, production build, strict TypeScript checks,
ESLint, formatting, shared/server tests, direct and proxied health checks, and
the local mock event sequence passed. The suite has 16 passing tests. Chromium
visual rendering could not be verified in the execution container; see
[ACCEPTANCE.md](ACCEPTANCE.md). Do not treat placeholder UI or simulation output
as real gameplay or Twitch connectivity.

## Known limitations

- The mock sequence uses synthetic viewer data and is not evidence of Twitch
  authorization or a live Twitch message.
- Dashboard and overlay surfaces are presentation shells; voting and battle
  controls are not functional gameplay.
- The available Chromium binary timed out even on a local static data page, so
  dashboard and overlay rendering remain visually unverified.
- Draft PR creation is pending the GitHub API credential problem recorded in
  [HANDOFFS.md](HANDOFFS.md); Git HTTPS read access works. Merge remains
  owner-controlled.

## Next authorized work

Review the Phase 0 branch, retry Draft PR creation after GitHub CLI API access is
restored, and visually smoke-test the dashboard and overlay in a working browser.
Do not start Phase 1 without separate owner authorization.
