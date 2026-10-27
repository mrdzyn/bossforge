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
5. Open `/overlay` in Chromium at 1920×1080, 1280×720, 430×932, 390×844,
   375×812 and 360×800. PASS if all
   content remains readable and inside the safe area without horizontal
   clipping, the current prompt is legible, and the page offers no vote-submit
   controls. At mobile widths, vertical scrolling is acceptable. P4A-C2
   corrected the earlier 390px clipping; see current viewport screenshots and
   bounding-box evidence in [`docs/visual-qa/p4a-c2-verified`](visual-qa/p4a-c2-verified/).
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

Historical post-P4A-C1 browser checks used a credential-free mock server at
`127.0.0.1:33301` and Vite at `127.0.0.1:5201`. The authenticated runtime on
ports 3001 and 5173 was left running and untouched. Dashboard captures were
made at 1280×720 and 390×844; overlay captures at 1920×1080, 1280×720 and
390×844. Desktop renders fit and show the active simulated vote, totals and
countdown. The mobile dashboard action row and overlay prompt/choice grid are
visibly clipped at the right edge at 390px. The document width remained 390px,
so `scrollWidth` alone missed this clipping. The defect was fixed in P4A-C2 and
the complete viewport matrix now passes based on visible element bounds. The
final mock-mode captures are listed in the P4A-C2 acceptance record below.
These browser captures are not OBS application evidence.

The historical C1 captures remain in [`docs/visual-qa/p4a-c1`](visual-qa/p4a-c1/):
[dashboard 1280×720](visual-qa/p4a-c1/dashboard-1280x720.jpg),
[dashboard 390×844](visual-qa/p4a-c1/dashboard-390x844.jpg),
[overlay 1920×1080](visual-qa/p4a-c1/overlay-1920x1080.jpg),
[overlay 1280×720](visual-qa/p4a-c1/overlay-1280x720.jpg), and
[overlay 390×844](visual-qa/p4a-c1/overlay-390x844.jpg). Final post-fix captures
are in [`docs/visual-qa/p4a-c2-verified`](visual-qa/p4a-c2-verified/), with
visible bounds and the exact validation record in
[ACCEPTANCE](ACCEPTANCE.md#p4a-c2--mobile-clipping-remediation).

### Owner OBS Browser Source checklist

The owner has supplied evidence that the Browser Source rendered visibly in OBS
at 1920×1080. The 1280×720 source appeared about 640×360 in a larger canvas, so
full-frame acceptance at that size remains pending. To complete the owner
retest:

1. Keep the isolated mock server and Vite running. In OBS Studio, open the
   intended scene and use **Sources → + → Browser** to add a Browser Source.
2. Name it `BossForge mock overlay`; use the URL
   `http://127.0.0.1:5201/overlay`. Do not enable Twitch or add credentials.
3. For the 1920×1080 case, create a Browser Source whose **Properties** width
   and height are 1920 and 1080. Confirm the mock overlay, simulated
   disclosure, prompt, choices, counts and countdown render legibly.
4. For the 1280×720 case, use a separate Browser Source and set its **Properties**
   width and height to 1280 and 720. Select that source, right-click, and choose
   **Transform → Fit to Screen**. Confirm the source fills the intended canvas
   frame and the content remains legible. Browser Source properties set the
   rendered viewport; **Fit to Screen** sets its transform/scale in the scene.
   Scaling a smaller viewport is not equivalent to rendering at 1280×720.
5. Save a screenshot of the OBS Studio window for each source/resolution. Keep
   these owner captures separate from Chromium evidence. Record 1280×720 as
   PASS only when the source fills the intended frame. If either render clips
   content or differs materially, record FAIL and include the screenshot.
   Chromium screenshots alone do not establish OBS PASS.

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
