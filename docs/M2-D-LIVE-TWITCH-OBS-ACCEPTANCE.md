# M2-D — Verified Twitch Combat and Native OBS Acceptance

**Phase state:** OWNER-SUPPLIED PARTIAL LIVE ACCEPTANCE RECORDED; remaining gates are open.
**Baseline:** `main` at `2893ba8b8d26de0fe032689c5ab69497f03a1486`.
**Implementation model:** M2-A/B/C and SVG polish are merged. M2-D gathers bounded deterministic evidence and owner-operated end-to-end acceptance; it does not add new damage, authentication, public routes, or gameplay features by default.
**Deadline context:** Codex × TwitchCon submission planned for November 3, 2026, 06:00 Asia/Manila; reconfirm official deadline before publishing.

## Entry conditions

1. Independently reviewed, merged base: M2-C PR #13 and VecSynIQ/Chromium PR #14. PR #14 source/security and 80-capture Chromium QA passed; this is **not** live Twitch or native OBS evidence.
2. Owner-provided preflight report on the former PR #14 branch: Node 24.21.0, pnpm 11.25.0; frozen install/build/typecheck/lint PASS; 107 focused OAuth/EventSub/combat/security tests PASS on authorized local rerun; all 262 workspace tests PASS separately (41 shared, 147 server, 74 web); four-stage mock simulation PASS. An initial concurrent SVG checksum check exceeded a 5-second test timeout but passed in the separate web suite with a 15-second timeout. Sandbox loopback tests hit EPERM and passed in the permitted local rerun. These are **agent-reported historical checks**, not yet re-executed on this exact main head.
3. The reported `pnpm format:check` failure was on **Git-ignored local** `.kilo/agent-manager.json`, not a demonstrated tracked-file defect. Do not modify or commit the local agent settings. Record any fresh formatting exception and verify tracked project files separately.
4. Hosted GitHub Actions, native OBS with the new live-battle HUD, and genuinely accepted Twitch `!hit` commands are **NOT VERIFIED**.
5. `AGENTS.md` and `config/project-profile.json` are absent from this repository at the verified baseline. If they appear, follow their project-specific rules.

## M2-D gate A — Local deterministic evidence (safe without Twitch secrets)

- Fetch exact `main` HEAD and record local branch, HEAD, clean worktree, Node and pnpm versions.
- Inspect the existing M0 locked contract, SECURITY, ACCEPTANCE, P3-B integration docs and relevant OAuth/EventSub/battle tests; do not reread unrelated historical files.
- Perform `pnpm install --frozen-lockfile`, `pnpm assets:check`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, full `pnpm test`, `pnpm simulate` using a **dedicated loopback mock-only server**, and `git diff --check`.
- Use the smallest targeted test group necessary to prove OAuth and EventSub verification, channel/source/reader identity, 8/14 damage, wrong-element behavior, duplicate/replay, 2-second cooldown, queue/rate/deadline bounds, disconnect cancellation, generation/epoch fencing, private projections, strict `!hit` parsing and no public browser damage route. Do not manufacture or send real Twitch traffic during tests.
- Local socket EPERM failures must be reported and, where allowed, rerun using the permitted local environment; do not convert a failed run into PASS without a recorded successful rerun.
- Report all commands, actual pass/fail counts, retries, timeout changes, source commit, and whether hosted CI ran. No secret-bearing environment dumps or live credentials in evidence.
- A preflight defect gets a narrowly scoped remediation branch/PR and independent source/security audit before real-service acceptance.

## M2-D gate B — Owner authorization and local Twitch preflight

**Owner authorization and connection observed:** The owner confirmed the registered callback and intentional local enablement, then authorized bounded local QA in [PR #15](https://github.com/mrdzyn/bossforge/pull/15#issuecomment-6499359393). OAuth consent and Twitch chat actions remained owner-controlled. The dashboard and sanitized diagnostics showed Twitch connected, one valid welcome, and one enabled `channel.chat.message` subscription. Authenticated identity was compared privately; do not copy it into reports. This records the observed session and does not authorize another OAuth session.

- Callback confirmed by owner as exactly `http://localhost:3001/auth/twitch/callback`; preserve this requirement. Do not paste account identities into a public report.
- Verify independently that 3001/5173 are free with `lsof -nP -iTCP:3001 -iTCP:5173 -sTCP:LISTEN`. If occupied, identify and seek owner direction; **never terminate an unknown process** or silently change callback ports.
- Existing confidential-client settings are local and gitignored: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_INTEGRATION_ENABLED=false` until authorized. Verify existence/ignore status without disclosing, printing or checking secrets into Git. Only the owner enables live integration and completes consent.
- When explicitly authorized, run loopback-only Fastify/Vite and open the owner dashboard at the origin required for cookie/Host policy. The registered Fastify callback must match; do not redirect OAuth to Vite.
- Require valid token/client ID/scope and verified `channel.chat.message` EventSub welcome + enabled Helix subscription for the broadcaster-as-reader channel before treating status as Twitch connected. OAuth success or socket-open alone is **not** proof of chat ingestion.
- Do not attempt a forge or battle if verified transport is unavailable. Preserve mock/Twitch provenance and no synthetic fallback.

## M2-D gate C — Bounded genuine Twitch vote-and-battle QA (owner-operated)

**Owner-supplied partial run (2026-10-29):** Four genuine stages produced Rime Veil (Wraith / Ice / Ember Burst / Water). One `!hit water` changed server-authoritative HP from 550 to 536 with one accepted attack. This is evidence of a matching-weakness hit in that encounter. Twitch rejected a repeated identical command within 30 seconds; that is not evidence that BossForge's 2-second cooldown rejected a command. Rime Veil expired/survived. A second display showed Cinder Granite (Golem / Fire / Thunder Dash / Water) survived. See [ACCEPTANCE](ACCEPTANCE.md) for provenance and limitations.

The full Low/60 sequence is not established by these results. Do not infer base 8 damage, BossForge cooldown rejection, Community Victory, or active HP synchronization in native OBS.

1. Open the authenticated dashboard and a separately read-only overlay; confirm **LIVE TWITCH** is shown only after verified EventSub subscription.
2. Start a four-stage forge. Have an actual viewer submit the exact currently displayed `!vote <category> <choice>` syntax during each open category; record which categories received accepted genuine votes and which used a server default. Verify a server-authoritative reveal and **BATTLE READY**.
3. Owner selects **Low / 60 seconds** and explicitly clicks **Start Battle**. Verify initial **100 HP** (the locked Generic v1 low-band 60-second matrix; if settings differ, use the actual server-selected HP and document the reason).
4. One authentic `!hit` from a viewer: after server acceptance, verify HP decreases by **8**, accepted aggregate increases by 1, and OBS reflects the change and impact animation.
5. Wait at least **2.1 seconds** after acceptance for that same viewer; send `!hit <actual displayed weakness>`. Verify **14 HP** additional damage and weakness accent. The weakness vocabulary is `water|light|earth|wind`.
6. For cooldown rejection, send one ordinary hit inside the 2-second per-viewer window following an accepted attack. Verify **no HP/count change** and only the allowed aggregate rejection signal. Do not flood chat.
7. Follow a bounded low-volume test path to a server-owned **COMMUNITY VICTORY! BOSS DEFEATED!**, or let the timer expire and verify **BOSS SURVIVED! TRY AGAIN!**. Do **not** claim both outcomes from one run.
8. Verify disconnect/revocation/logout fail closed: an active Twitch battle is cancelled with fixed reason, stale HP/commands are removed, and reconnect requires a **new** encounter; never auto-resume or silently switch to mock.
9. Keep genuine chat message-ID replay injection **out of live Twitch testing**; the deterministic injected fake-network security tests cover that gate. Do not manufacture live Twitch messages or claim replay was observed genuinely.

If the test encounters an authorization, source-isolation, privacy or authority failure, **stop the live session**, record only sanitized evidence and route the defect to a bounded PR + independent audit.

## M2-D gate D — Native OBS Studio (owner-operated)

- On the same authorized loopback session, add the existing local `/overlay` route as an OBS **Browser Source**; do not add a control-bearing dashboard page.
- Verify Browser Source property size **1920 × 1080**, then **1280 × 720** and **Transform → Fit to Screen**; distinguish OBS preview scaling from the actual source dimensions.
- Inspect real transparency over light/dark gameplay, SVG image integrity, continuous character motion, base/weakness hit feedback, first-viewport boss/HP/timer/commands, source disclosure, terminal scenes, and no clipped labels.
- Capture screenshots **from OBS Studio**. Chromium's 80 measured captures are valuable prior UI evidence but **not** native OBS proof.
- Before sharing demo or screenshots, exclude chat docks, viewer names/IDs, cookies, OAuth callback/query strings, credentials, account emails, console secrets, and raw logs. OBS must remain read-only.

## M2-D pass/fail record — current evidence

| Gate                                             | Result         | Evidence / limitation                                                                                                                                                                   |
| ------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: deterministic security and full suite         | PARTIAL        | All 262 package tests pass separately; root parallel `pnpm test` has a recorded SVG test timeout. See [M2-D Gate A evidence](ACCEPTANCE.md#m2-d-gate-a--deterministic-local-preflight). |
| B: owner permission, OAuth and verified EventSub | PASS — observed | Owner-authorized, owner-operated consent; one valid welcome and one enabled subscription; identity privately checked                                                                     |
| C: genuine votes                                 | PASS — owner-supplied | Four genuine categories, one accepted ballot each; Rime Veil revealed                                                                                                                 |
| C: matching-weakness hit                         | PASS — owner-supplied | 550 → 536 HP; one accepted hit; base damage not verified                                                                                                                             |
| C: BossForge cooldown and base damage            | NOT VERIFIED   | Platform rejected duplicate within 30 seconds; no BossForge cooldown rejection or base-8 result established                                                                             |
| C: terminal and recovery                         | PARTIAL        | Rime Veil expired; second boss shown survived. Community Victory and disconnect/reconnect behavior not verified; dashboard/API stale-state mismatch observed after expiry                 |
| D: OBS presence                                  | PARTIAL — owner-supplied | BossForge visible alongside Elevator, Please! Native source sizes/fit and active HP synchronization not verified                                                                      |
| E: evidence hygiene and independent audit        | PENDING        | Sanitized records only; screenshots owner-supplied/not attached; authority mismatch must be resolved before further live testing                                                         |

For each owner test, record: Asia/Manila date/time, branch and exact HEAD, source environment (mock/Twitch), exact server-authoritative before/after HP, accepted/rejected aggregates, UI/OBS outcome, screenshot paths, reason for failure, retry status, and whether evidence is owner-supplied or independently observed.

## Submission handoff — separate authorization

- Genuine end-to-end demo evidence and sanitized screenshots come **after** gates B–D; do not present historical P3-B voting, simulated attack tests or Phaser arena as proof of current real Twitch battle damage.
- Prepare a **public YouTube video under three minutes**, showing the real Twitch connection/boss assembly, authenticated streamer start, HP changes in native OBS, server-owned outcome, and truthful Codex use. Exclude personal or secret data.
- Record a **real** Codex session ID from the actual active Codex session's `/status`. Do not invent session IDs, videos, test results, Twitch messages or dates.
- Final Devpost submission, video publishing, deployment and repo merge require explicit owner approval. See [Hackathon checklist](HACKATHON.md) and [M0 contract](M0-ANY-GAME-CONTRACT-LOCK.md).

**Exit criterion:** Gates A–D have explicit, scoped PASS evidence, independent final exact-head assessment, and owner confirmation. A successful synthetic test alone is insufficient for a real Twitch/OBS PASS.
