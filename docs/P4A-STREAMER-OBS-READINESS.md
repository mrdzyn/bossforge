# Phase 4-A — Streamer Voting UX and OBS Readiness

**Status:** In progress on `feat/p4a-streamer-voting-ux`, based on `main` at
`76a5ddeeea0986aae2ed073deaeb1a5b02fb6280`. Phase 3-B PR #5 is already merged.
This work does not start OAuth, access the authenticated runtime, activate
Twitch, or submit Phase 5 materials.

## Streamer and viewer experience

- During an open category, the dashboard and read-only `/overlay` show its
  current choices, remaining time and current counts. A single leading choice
  is labeled as the current leader; a tie is labeled as tied. Neither is
  presented as a final winner before the server closes the stage.
- In verified Twitch mode, the active category displays the exact accepted
  syntax `!vote <category> <choice>` plus one command per valid canonical
  choice. For example, the Body command for Drake is `!vote body drake`.
  Category and choice values are sourced from `FORGE_VOTE_CHOICES` in
  `packages/shared/src/index.ts`; human-readable labels do not change command
  spelling. Categories progress through `body`, `element`, `special`, and
  `weakness`.
- A completed community-selected result is labeled **COMMUNITY VOTE**. When a
  category has no valid votes, the selected first-choice fallback is labeled
  **DEFAULT · No valid votes**. A fallback is not described as a viewer vote.
- Mock mode is labeled **SIMULATED** and explains that Twitch is disconnected;
  Twitch commands are not shown there. Twitch mode without a verified
  connection is labeled **DISCONNECTED** and voting is paused. The overlay has
  no controls for submitting votes or operating the forge.
- The dashboard's existing duration selector remains 15 / 30 / 60 seconds per
  category. It is not represented as available in the overlay.

## Owner-controlled browser and OBS acceptance

Run this checklist only when the owner chooses to test the application. It does
not authorize a new OAuth flow or Twitch test by itself.

1. Start the local app with the normal documented, loopback-only procedure.
   Confirm the dashboard at `http://localhost:5173` and the local health route
   at `http://localhost:3001/health`. Do not expose a public listener or tunnel.
2. If real Twitch QA is separately authorized, the owner privately configures
   local credentials, personally completes Twitch consent, and uses **Connect
   Twitch**. Confirm the dashboard says **TWITCH CONNECTED** only after the
   EventSub subscription is verified. Otherwise remain in simulation mode.
3. On the dashboard, choose 15, 30, or 60 seconds per category. Start a cycle.
   PASS if the active category, exact commands, seconds remaining, totals, and
   live-versus-simulated state match the authoritative dashboard state.
4. In a verified live session, send one genuine command that matches the
   currently open category. PASS if the server-authoritative total changes and
   the dashboard and overlay reconcile. A command for another stage or an
   unsupported choice must not be counted. Do not use synthetic input to claim
   live functionality.
5. Open `/overlay` in Chromium at 1920×1080, 1280×720 and 390×844. PASS if all
   content remains readable and inside the safe area without horizontal
   overflow, the current prompt is legible, and the page offers no vote-submit
   controls. At mobile width, vertical scrolling is acceptable.
6. In mock mode, PASS if the overlay explicitly says **SIMULATED**, shows no
   Twitch vote commands, and does not imply a real connection. In a deliberately
   disconnected Twitch state, PASS if it says **TWITCH DISCONNECTED / VOTING
   PAUSED** and offers no active vote prompt.
7. Let each stage complete. PASS if a real winning ballot is labeled
   **COMMUNITY VOTE**, while an empty category clearly says **DEFAULT · No
   valid votes**. Verify that the final boss and arena state reconcile.
8. To verify actual OBS capture, add a Browser Source in the OBS application
   that the owner will use, point it at the local `/overlay` URL, set the
   intended 1920×1080 or 1280×720 canvas, and confirm the rendered source in the
   OBS preview/program. Record this separately from Chromium QA. Do not claim
   OBS PASS from a browser screenshot.

### Disposable Chromium evidence

The Phase 4-A candidate was rendered in mock mode on isolated loopback ports.
Captured dashboard sizes were 1280×720 and 390×844; overlay sizes were
1920×1080, 1280×720 and 390×844. The 390px dashboard and overlay document
widths measured exactly 390px, with no horizontal overflow. See the images in
[`docs/visual-qa/p4a`](visual-qa/p4a/) and the detailed gate record in
[ACCEPTANCE](ACCEPTANCE.md#phase-4-a--streamer-voting-ux-and-obs-readiness).
These captures show synthetic test state only.

## Evidence boundaries and Phase 5 preparation

P3-B live results remain owner-supplied and were not independently reproduced:
OAuth/EventSub and connection stability PASS; 6 notifications, 6 normalized
messages, 6 callbacks; 3 genuine ballots accepted and 3 rejected; all four
stages completed; Special used its no-vote default; Phaser arena VICTORY. These
results do not show a genuine accepted vote in all four categories. Actual OBS
application capture remains **UNVERIFIED**.

For future hackathon submission preparation, collect a genuine Twitch demo,
actual OBS capture, Phaser battle, a reproducible installation/run, a YouTube
demo shorter than three minutes, and Codex development footage with its real
session ID. The owner must supply/verify the session ID and authorize any public
video or submission. Do not invent footage or credentials. Phase 5 has not
started.

See [acceptance evidence](ACCEPTANCE.md), [current status](STATUS.md), and
[roadmap](ROADMAP.md).
