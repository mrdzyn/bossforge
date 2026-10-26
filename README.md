# BossForge Live

**Chat creates the boss. The streamer fights it.**

BossForge Live is an interactive browser game concept for Twitch streams. The
audience will shape a monster through chat and the streamer will fight it in an
arcade arena. Phase 0 establishes a local development foundation and a
broadcast-oriented UI shell.

## Current status

**Implemented in Phase 0:** TypeScript/pnpm workspace, validated shared
contracts, Fastify health and WebSocket server, a deterministic local mock chat
adapter, streamer dashboard shell, and OBS overlay preview.

**Planned:** Audience voting, boss assembly, playable combat, and official Twitch
OAuth/EventSub integration. The mock adapter uses synthetic data and is not a
Twitch connection. Voting and battle panels are placeholders.

See [project status](docs/STATUS.md), [architecture](docs/ARCHITECTURE.md), and
[roadmap](docs/ROADMAP.md).

## Requirements

- Node.js 22.13 or newer in the Node 22 LTS line, or Node.js 24 LTS.
- pnpm 11.25.0 (Corepack can select the version pinned in `package.json`).

No Twitch credentials, database, Docker, or external API is needed for Phase 0.

## Install and run

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
corepack pnpm dev
```

The dashboard runs at <http://127.0.0.1:5173>. The local Fastify server listens
on <http://127.0.0.1:3001> by default. The `/health` endpoint reports the
server status, version, timestamp, and local connection counts.

To trigger a sequence of synthetic viewer and chat events while development is
running, use another terminal:

```bash
corepack pnpm simulate
```

The dashboard's **Generate chat event** button also advances the local mock
sequence one event at a time. The developer simulation routes are only
registered outside production mode. Both local services bind to loopback by
default.

## OBS overlay preview

Open <http://127.0.0.1:5173/overlay> for the broadcast presentation. It shares
the local event stream and omits streamer administration controls. The layout is
designed for 1920×1080 and 1280×720 safe areas. Boss health and voting values are
placeholders until later phases implement gameplay.

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

Copy `.env.example` to `.env` before starting `pnpm dev`. These values are
local-only configuration; never add Twitch credentials to the example file or
browser environment.
