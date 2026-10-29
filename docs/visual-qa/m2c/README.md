# M2-C Chromium visual QA

Captured 2026-10-29 with isolated headless Google Chrome against the local
mock-only server on `127.0.0.1:33301` and Vite on `127.0.0.1:5201`. The server
was started with Twitch disabled and an empty inherited environment. The
captures contain synthetic game state only. They are Chromium evidence, not
native OBS evidence.

## State captures

- [Awaiting forge, 1920×1080](awaiting-1920x1080.png)
- [Four-stage voting, 1920×1080](live-voting-1920x1080.png)
- [Battle ready, 1920×1080](battle-ready-1920x1080.png)
- [Active battle, 1920×1080](battle-active-1920x1080.png)
- [Active battle, 1280×720](battle-active-1280x720.png)
- [Active battle, 1600×900](battle-active-1600x900.png)
- [Active battle, 390×844](battle-active-390x844.png)
- [Final active battle after contrast adjustment, 1920×1080](battle-active-final-1920x1080.png)
- [Final active battle after contrast adjustment, 1280×720](battle-active-final-1280x720.png)
- [Final active battle after contrast adjustment, 1600×900](battle-active-final-1600x900.png)
- [Final active battle after contrast adjustment, 390×844](battle-active-final-390x844.png)
- [Active HUD over a simulated light background, 1280×720](battle-active-light-background-1280x720.png)
- [Second encounter, 1600×900](battle-active-second-encounter-1600x900.png)
- [Second encounter, 390×844](battle-active-second-encounter-390x844.png)
- [Low HP, 1920×1080](battle-low-hp-1920x1080.png)
- [Community victory, 1920×1080](community-victory-1920x1080.png)
- [Community victory, 1280×720](community-victory-1280x720.png)
- [Boss survived, 1920×1080](boss-survived-1920x1080.png)
- [Boss survived, 1280×720](boss-survived-1280x720.png)
- [Owner cancellation, 1920×1080](battle-cancelled-1920x1080.png)
- [Server unavailable, 1920×1080](server-unavailable-1920x1080.png)
- [Recovered after server restart, 1920×1080](server-recovered-1920x1080.png)

`layout-observations.json` records viewport size, scroll dimensions, measured
element rectangles, horizontal overflow checks, visible text and computed
background colors for the main state set. At 1280×720 the active HUD bottom was
y=570; at 390×844 it was y=784.4. All tested scroll widths equaled the
viewport widths, and no measured visible element crossed the viewport's
horizontal edges. Lower forge recap content can extend below the fold; the
active combat information remains visible without scrolling.

The root and body backgrounds computed to transparent in the overlay capture;
HUD cards use translucent dark panels over the stream. Visual review confirmed
legibility in both the default dark/checkerboard preview and the forced white
compositor background. Header labels use dark translucent pills for contrast.
These captures do not constitute a native
OBS Browser Source test or owner acceptance.

## Synthetic flow evidence

The actual local server/browser flow completed four mock vote categories,
opened authoritative battle `ready`, started a battle through the same-origin
owner API, routed eight synthetic weakness-matching `!hit` messages through
the existing simulation ingress, and reached server `victory` at 0 HP. A
separate battle reached server `expired`; a third owner-cancelled encounter
rendered the fixed safe cancellation label. No mock browser damage endpoint
was added. The development mutation limiter was retained; an over-limit
third-cycle attempt was refused and was retried only after a fresh isolated
server lifecycle. This is not genuine Twitch traffic.

Stopping the isolated server produced the unavailable capture: HP and attack
instructions were absent and the page showed `SERVER LINK UNAVAILABLE / BATTLE
STATUS UNKNOWN`. Restarting with the expected local Vite Origin restored the
WebSocket; the overlay adopted the new server epoch only after its fresh HTTP
snapshot and returned to simulated idle without replaying the previous battle.

No credentials, Twitch network, viewer identities, private chat, or native OBS
application were used. The optional `/arena` page was not changed.
