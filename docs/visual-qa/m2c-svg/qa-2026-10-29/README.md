# M2-C integrated Chromium visual acceptance — 2026-10-29

## Provenance and scope

- Reviewed PR #14 head: `9703e181a9cf684db02f72a15ccce68d01cc18a7`.
- Browser: locally installed Google Chrome, driven by Playwright 1.62.1 from the approved local Mac development environment. A new browser context was used; no saved Chrome profile, Work browser setting, OAuth session, or credentials were accessed.
- App: actual BossForge dashboard and `/overlay`, served by Vite at `http://127.0.0.1:5205`; actual Fastify at `http://127.0.0.1:33305`. Both bound to loopback. Twitch was explicitly disabled (`configured=false`, `mode=mock`, `connected=false`). Existing authenticated ports 3001/5173 were not touched.
- Forge votes and attacks were synthetic normalized mock chat submitted through the existing loopback development simulation ingress. No browser damage endpoint, live Twitch, external service, or static-art mockup was used as application evidence.
- Browser captures use device scale factor 1. The screenshot state is visible in each filename.

## Result

**Integrated Chromium visual acceptance: PASS. No confirmed visual defect; no source change was needed.**

The dashboard and overlay were observed in idle, voting, ready, active, hit, low-HP, victory, expired, cancelled, unavailable, and recovered states. All four original character SVGs loaded in the actual overlay: Golem, Wraith, Drake, and Mimic. Representative element combinations rendered as Golem/Fire, Wraith/Ice, Drake/Storm, and Mimic/Void. The original BossForge branding loaded; the compact crest and logo had no failed image requests. No broken asset or application response, browser page error, or horizontal overflow was observed in the instrumented captures.

At 1280×720 in active battle, the overlay DOM measurements were:

- Boss presentation: `x=51.2..1228.8`, `y=76..250`.
- Active battle HUD: `x=51.2..1228.8`, `y=259..582`.
- HP bar: `x=84.2..1195.8`, `y=464..492`.
- Exact chat instructions: `x=84.2..1195.8`, `y=512..549`.

Thus the boss art, current/max HP, countdown, attack aggregate, weakness, source disclosure, and attack instructions fit in the first 1280×720 viewport. The lower forge summary can continue below the viewport; it does not displace the combat-critical information. At 390×844 there was no horizontal overflow; the narrower composition is vertically scrollable.

The overlay root computed to `background-color: transparent` and `background-image: none`; captured PNGs have an alpha channel. Panels retain a translucent dark fill (`rgba(17, 16, 27, 0.92)`). Separate light (`#f4f4f7`) and dark (`#090a12`) composites were made from the actual transparent active-overlay capture and visually checked. Both kept labels, HP, timer, commands, and branding legible. These are Chromium-image compositing previews, not native OBS captures.

The reduced-motion browser context reported `prefers-reduced-motion: reduce`; state-triggered hit/weakness classes were absent. The ambient CSS animation names remain present but their reduced-motion duration is near-instant. No formal frame-rate or continuous-animation performance profiling was performed.

The child-process server-loss test stopped only its own isolated Fastify child while an active encounter was visible. The open overlay changed to `SERVER LINK UNAVAILABLE / BATTLE STATUS UNKNOWN`; HP and `!hit` instructions disappeared. After restarting the mock server, the client adopted a fresh server epoch and idle snapshot, with no stale HP, timer, attack prompt, or terminal claim restored. Dashboard and overlay pre-loss captures were measured at all four viewport sizes; the before/loss/recovery sequence itself is additionally captured at 1280×720.

## Viewport and state coverage

`measurements.json` contains 80 instrumented dashboard/overlay captures: 32 dashboard and 48 overlay entries, with 20 entries each at 1920×1080, 1600×900, 1280×720, and 390×844. It records viewport dimensions, document scroll size, horizontal-overflow result, visible component bounds, image load results, state text, and overlay background. Recorded page errors, failed responses, and assertion failures: **0**. The loss/recovery/expired captures listed below supplement the measured capture set.

| State / scenario                | Evidence                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Idle and voting                 | `dashboard-idle-*`, `dashboard-voting-*`, `overlay-idle-*`, `overlay-voting-*`                                                     |
| Four bodies and ready/reveal    | `overlay-ready-golem-*`, `overlay-ready-wraith-*`, `overlay-ready-drake-*`, `overlay-ready-mimic-*`                                |
| Active and hits                 | `overlay-active-full-hp-*`, `overlay-active-base-hit-*`, `overlay-active-weakness-hit-*`, `overlay-active-low-hp-*`                |
| Reduced motion                  | `overlay-active-reduced-motion-*`, `reduced-motion-observation.json`                                                               |
| Victory / expiry / cancellation | `overlay-victory-*`, `overlay-expired-*`, `overlay-cancelled-owner-*`; matching dashboard captures are present for terminal states |
| Server loss / recovery          | `overlay-active-before-server-loss.png`, `overlay-after-server-loss.png`, `overlay-after-server-recovery.png`                      |
| Light/dark compositing          | `overlay-active-light-composite-1280x720.png`, `overlay-active-dark-composite-1280x720.png`                                        |

Use `measurements.json` as the source for measured element rectangles and image-load results. In the reduced-motion note, decorative ambient animation declarations are not described as completely removed; the state-triggered impact feedback is suppressed and reduced-motion CSS shortens ambient motion.

## Screenshot record

PNG files in this directory are direct screenshots of the actual local application unless their filename contains `composite`, in which case they are post-capture alpha composites of the actual transparent overlay screenshot. No static character sheet is presented as application QA. The retained `source-asset-review.png` in the parent directory is only source-art inspection.

## Limits

- This is synthetic mock-mode browser QA, not genuine Twitch voting or EventSub validation.
- Chromium transparency/compositing does not establish native OBS Browser Source behavior. Native OBS acceptance remains a separate check.
- The app is a local development build; no hosted GitHub Actions result is represented here.
- No continuous FPS, GPU, or long-duration performance benchmark was run. Image requests completed and no browser errors were observed.
- No code, gameplay, server authority, Phaser behavior, Twitch configuration, or credentials were changed for this QA pass.
