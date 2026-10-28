# BossForge Live

**Proposed direction: Chat creates the boss. Chat fights the boss. The streamer keeps playing their game.**

BossForge Live currently provides audience boss voting, a read-only OBS
overlay, verified local Twitch integration, and an optional Phaser arena. The
approved-for-planning PDCP-001 proposal pivots the primary product toward a
game-agnostic Twitch engagement overlay: chat creates and fights the boss while
the streamer keeps playing their game. The proposed server-authoritative chat
battle and `!hit` system are not implemented; Phaser remains an optional
self-contained demo.

## Current status

**Implemented in Phase 1:** Four sequential timed vote categories, one mutable
vote per mock viewer/category, deterministic ties and fallbacks, in-memory
session state, modular boss traits and bounded statistics, streamer controls,
a read-only live OBS overlay, and repeatable synthetic simulation.

**Phase 1:** Independently source-reviewed and squash-merged to `main` via PR #2.
**Phase 2:** Independently source-reviewed through C2 and squash-merged to `main` via PR #3. A local Phaser 3 battle is playable. Run `pnpm simulate`,
open the dashboard, and choose **Enter Arena** after the reveal. Controls:
WASD/arrows move, click or Space fires toward the pointer, Shift dodges, and
1–4 selects water/light/earth/wind ammunition. Matching the revealed weakness
deals 75% bonus damage. Combat is a local browser simulation and battle results
are not persisted.

**Phase 3-A:** [Offline EventSub integration readiness](docs/P3-TWITCH-INTEGRATION-READINESS.md)
was independently source-reviewed and squash-merged as PR #4. Its fixture-only
normalizer and lifecycle harness are reused by the separately authorized P3-B
branch; P3-A itself remains offline and mock-only.

**Phase 3-B:** [Real local Twitch integration](docs/P3B-LIVE-TWITCH-INTEGRATION.md)
was squash-merged to `main` via PR #5 at `76a5dde`. OAuth/EventSub remain gated by explicit
local configuration. The owner reports live OAuth/EventSub PASS, one valid
welcome, one enabled Helix subscription, 11 keepalives for the advertised
30-second timeout, 6 accepted/normalized notifications and 6 chat callbacks.
Three genuine ballots were accepted and three rejected (one wrong-category,
two invalid-choice), with no disconnects, socket closes/errors, or forge
cancellations. The four-stage forge revealed Cinder Granite (Golem / Fire /
Ember Burst default / Earth); Special used its no-vote default, so accepted
genuine ballots in all four categories are not claimed. The owner reports a
Phaser VICTORY (boss 0/120 HP; streamer 64/100 HP). These P3-B live results are
owner-supplied and not independently reproduced; that Twitch run did not include
OBS capture. Separate P4A owner-supplied visual QA in the actual OBS Studio
application passes at 1920×1080 and 1280×720 in simulated mode. It does not
establish a new real Twitch vote, live HP synchronization or continuous
animation performance. Automated validation is separate: 124 tests passed at
implementation commit `279ff63fc803921310226d9c6903a029af7f0bd5` using fake
transports. For a local account, the owner must personally approve/configure
OAuth: set the registered Client ID and private Client Secret in gitignored
`.env`, then explicitly set `TWITCH_INTEGRATION_ENABLED=true`. The server
remains loopback-only and mock simulation remains available. **Phase 4-A
frontend acceptance is PASS** and PR #6 was squash-merged into `main` at
`5655dea53e3eba5425b6ead8926659a0bb72ae5e`:
canonical voting instructions, fresh-state protections, tie-aware totals,
community/default attribution, mobile clipping remediation and responsive
Chromium QA are documented as complete. The 149-test result (29 shared, 19 web,
101 server) is historical automated evidence, separate from synthetic
simulation, Chromium QA, owner-supplied OBS results and historical live Twitch
evidence. Owner-supplied OBS visual results pass at 1920×1080 and native
1280×720 with Fit to Screen; they do not establish live HP synchronization or
continuous animation performance. See [Phase 4-A readiness](docs/P4A-STREAMER-OBS-READINESS.md)
and [acceptance evidence](docs/ACCEPTANCE.md#p3-b4-c5-r2--eventsub-keepalive-remediation).

**PDCP-001 is planning only** on existing Draft PR #7. The current raw-chat
browser broadcast path is not privacy-safe; the required M1 server-side privacy
migration must precede M2. No `!hit` combat, authoritative battle HP or game
profiles are implemented, and no milestone implementation is authorized.

See [project status](docs/STATUS.md), [architecture](docs/ARCHITECTURE.md), and
[roadmap](docs/ROADMAP.md).

## Requirements

- Node.js 22.13 or newer in the Node 22 LTS line, or Node.js 24 LTS.
- pnpm 11.25.0 (Corepack can select the version pinned in `package.json`).

No Twitch credentials, database, Docker, or external API is needed for local forge and arena demos.

## Install and run

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
corepack pnpm dev
```

The dashboard runs at <http://127.0.0.1:5173>. The local Fastify server listens
on <http://127.0.0.1:3001> by default. The `/health` endpoint reports the
server status, version, timestamp, and local connection counts.

To run a complete four-category local cycle while development is running, use
another terminal. The script uses short vote windows and two synthetic voters
per category, and can be repeated after a reveal:

```bash
corepack pnpm simulate
```

The dashboard's **Generate event** button also advances the local mock sequence
one event at a time. The developer simulation routes are only
registered in explicit development mode. Both local services bind to loopback by
default.

## OBS overlay preview

Open <http://127.0.0.1:5173/overlay> for the broadcast presentation. It shares
the local event stream and omits streamer administration controls. The layout is
designed for 1920×1080 and 1280×720 safe areas. During verified Twitch voting,
the overlay presents exact chat commands for the active category, current
counts, leader/tie status and countdown. Simulation and disconnected states are
labeled separately; defaults are identified explicitly. Voting and boss details show live simulation state; the OBS boss health is a
forge-derived statistic, not live client-side combat health. Combat results are
not yet synchronized to the OBS overlay.

## Development commands

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start the local server and Vite dashboard/overlay |
| `pnpm build`        | Build all workspace packages and applications     |
| `pnpm lint`         | Run ESLint across workspace source and tests      |
| `pnpm typecheck`    | Run strict TypeScript checks                      |
| `pnpm test`         | Run shared contract and server integration tests  |
| `pnpm simulate`     | Send the deterministic local mock event sequence  |
| `pnpm format:check` | Check repository formatting                       |

Copy `.env.example` to `.env` before starting `pnpm dev`. Twitch variables are
empty and disabled in the example. Keep real credentials in gitignored local
configuration and never place them in the browser environment.
