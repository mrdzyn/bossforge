# Boss Motion V1 visual QA

Date: 2026-10-30 (Asia/Manila)
Application: isolated local BossForge development server and Vite at
`127.0.0.1:33301` and `127.0.0.1:5201`. Twitch was explicitly disabled and
the server was started with an empty environment allowlist. All voting and
attacks in this QA were synthetic mock events.

## Final captures

`final-viewports.json` records 16 final integrated-app captures: dashboard and
read-only `/overlay`, each showing Wraith, Golem, Drake and Mimic at 1920×1080
and 1280×720. The automated browser measurements found no horizontal overflow,
missing asset, off-stage character image or viewport clipping in those
captures. Overlay page backgrounds computed transparent; content panels remain
translucent for contrast. Dashboard captures are scrolled to the boss-art panel
so the actual `AnimatedBoss` component is visible.

`final-interaction-results.json` records the mock battle pass at 1280×720 and
1920×1080: full HP 100, synthetic base hit to 92, synthetic weakness hit to
78, and 9 accepted synthetic hits ending at 22 HP. The state remained fresh
after a browser feed loss/recovery; the unavailable view hid current combat
authority. Owner cancel produced a cancelled presentation. Under reduced
motion, the character animation computed to `none`. These are local mock UI
results, not genuine Twitch or native OBS evidence.

`final-motion-before-1280x720.png` and `final-motion-after-1280x720.png` are a
short visual comparison. `motion-demo.webm` is a short browser recording. No
credentials, genuine chat, or viewer information were used.

## Artifact provenance

The final files prefixed `final-` and the 16 files named
`ready-{body}-{dashboard|overlay}-{size}.png` are the acceptance capture set.
The directory also preserves exploratory screenshots, intermediate
measurement JSON, and Playwright runner-generated `page@*.webm` copies from
earlier iterations. Those are retained as history and are superseded by the
final JSON records above; they must not be treated as final acceptance
measurements.

The integrated browser run used Playwright with local Chrome 141 in the
authorized environment. Exact Chromium build metadata was not retained. The
post-run sandbox browser launch was blocked by macOS Mach-port `EPERM`; it was
not used as evidence. Actual OBS
Studio, live Twitch, sustained frame-rate/performance profiling, and
1920×1080/1280×720 native Browser Source capture remain unverified.

## Runtime note

At task start the owner's local ports 3001 and 5173 were listening and were not
intentionally stopped or restarted. During dependency restoration after a
Prettier invocation unexpectedly attempted to recreate `node_modules`, a
registry DNS failure occurred; subsequent read-only checks found 3001 and 5173
no longer listening. No credentials were read and no Twitch or OBS action was
taken. The owner runtime was not restarted. This incident is recorded rather
than claiming the owner's runtime remained available throughout the task.
