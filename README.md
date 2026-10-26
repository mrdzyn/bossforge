# BossForge Live

**Chat creates the boss. The streamer fights it.**

BossForge Live is an interactive browser game concept for Twitch streams. The
audience will shape a monster through chat and the streamer will fight it in an
arcade arena. Phase 1 established server-authoritative local voting and a
broadcast-oriented OBS overlay. Phase 2 delivered the playable local boss battle.

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
is implemented on existing Draft PR #5, with OAuth/EventSub gated by explicit
local configuration. Automated tests use fake HTTP and WebSocket transports;
real Twitch consent, subscription and chat voting remain **NOT TESTED**. To
enable a local account, review/apply the cloud environment configuration draft,
set the registered Client ID and private Client Secret in gitignored `.env`,
then set `TWITCH_INTEGRATION_ENABLED=true`. The server remains loopback-only.
Until OAuth and EventSub are actually verified, use the visible SIMULATED mode.

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
designed for 1920×1080 and 1280×720 safe areas. Voting and boss details show live simulation state; the OBS boss health is a
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
