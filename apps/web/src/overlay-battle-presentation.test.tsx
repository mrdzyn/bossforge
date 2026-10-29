import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ForgeState, OverlayBattleStateV1 } from "@bossforge/shared";
import { OverlayBattleHud } from "./OverlayBattleHud.js";
import {
  battleCountdownLabel,
  overlayBattleView,
  shouldAnimateAcceptedHits,
} from "./overlay-battle-presentation.js";

const epoch = "2026-10-29T00:00:00.000Z";
const forge = {
  serverInstanceId: "s1",
  serverStartedAt: epoch,
  revision: 4,
  cycleId: "forge-1",
  status: "revealed",
  mode: "mock",
  simulated: true,
  connectedToTwitch: false,
} as unknown as ForgeState;
const battle = {
  schemaVersion: 1,
  serverInstanceId: "s1",
  serverStartedAt: epoch,
  revision: 2,
  status: "active",
  forgeIdentity: {
    serverInstanceId: "s1",
    serverStartedAt: epoch,
    cycleId: "forge-1",
    mode: "mock",
  },
  encounterId: "enc-1",
  forgeCycleId: "forge-1",
  bossSnapshot: {
    id: "b1",
    name: "Cinder Granite",
    attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
  },
  audienceBand: "low",
  durationSeconds: 60,
  startedAt: epoch,
  deadlineAt: "2099-01-01T00:01:00.000Z",
  currentHp: 72,
  maxHp: 100,
  acceptedHitCount: 2,
  baseHitCount: 1,
  weaknessHitCount: 1,
  damageApplied: 28,
  cancelReason: null,
} as unknown as OverlayBattleStateV1;

describe("authoritative overlay battle composition", () => {
  const base = { connection: "connected", forgeFresh: true, battleFresh: true, forge, battle };
  it("requires fresh matching full forge identity and actual battle status", () => {
    expect(overlayBattleView(base)).toBe("active");
    expect(overlayBattleView({ ...base, battleFresh: false })).toBe("unavailable");
    expect(
      overlayBattleView({
        ...base,
        battle: {
          ...battle,
          forgeIdentity: { ...battle.forgeIdentity!, mode: "twitch" },
        } as OverlayBattleStateV1,
      }),
    ).toBe("waiting-battle");
    expect(
      overlayBattleView({
        ...base,
        battle: { ...battle, status: "ready" } as OverlayBattleStateV1,
      }),
    ).toBe("ready");
  });

  it("renders server HP, accessible progress, exact commands and simulated disclosure", () => {
    const html = renderToStaticMarkup(<OverlayBattleHud battle={battle} view="active" simulated />);
    expect(html).toContain("72 / 100");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="72"');
    expect(html).toContain("!hit water");
    expect(html).toContain("SIMULATED");
    expect(html).not.toContain("LIVE TWITCH");
  });

  it("uses exact cooperative terminal messages and fixed cancellation labels", () => {
    expect(
      renderToStaticMarkup(<OverlayBattleHud battle={battle} view="victory" simulated />),
    ).toContain("COMMUNITY VICTORY! BOSS DEFEATED!");
    expect(
      renderToStaticMarkup(<OverlayBattleHud battle={battle} view="expired" simulated />),
    ).toContain("BOSS SURVIVED! TRY AGAIN!");
    const cancelled = renderToStaticMarkup(
      <OverlayBattleHud
        battle={{ ...battle, cancelReason: "twitch_disconnected" } as OverlayBattleStateV1}
        view="cancelled"
        simulated
      />,
    );
    expect(cancelled).toContain("BATTLE CANCELLED");
    expect(cancelled).toContain("TWITCH CONNECTION LOST");
  });

  it("hides all combat claims and commands when authority is unavailable", () => {
    const html = renderToStaticMarkup(
      <OverlayBattleHud battle={null} view="unavailable" simulated={false} />,
    );
    expect(html).toContain("SERVER LINK UNAVAILABLE");
    expect(html).toContain("BATTLE STATUS UNKNOWN");
    expect(html).not.toContain("72 / 100");
    expect(html).not.toContain("!hit");
  });

  it("does not show commands while ready or disconnected", () => {
    const ready = renderToStaticMarkup(<OverlayBattleHud battle={battle} view="ready" simulated />);
    const disconnected = renderToStaticMarkup(
      <OverlayBattleHud battle={null} view="disconnected" simulated={false} />,
    );
    expect(ready).toContain("BATTLE READY");
    expect(ready).not.toContain("!hit");
    expect(disconnected).toContain("TWITCH DISCONNECTED");
    expect(disconnected).not.toContain("!hit");
  });

  it("animates only a same-epoch, same-encounter authoritative accepted-hit increment", () => {
    expect(shouldAnimateAcceptedHits(null, battle, "active")).toBe(false);
    expect(
      shouldAnimateAcceptedHits(
        battle,
        { ...battle, revision: 3, acceptedHitCount: 3 } as OverlayBattleStateV1,
        "active",
      ),
    ).toBe(true);
    expect(
      shouldAnimateAcceptedHits(
        battle,
        {
          ...battle,
          revision: 3,
          encounterId: "enc-2",
          acceptedHitCount: 3,
        } as OverlayBattleStateV1,
        "active",
      ),
    ).toBe(false);
    expect(
      shouldAnimateAcceptedHits(
        battle,
        {
          ...battle,
          revision: 3,
          serverStartedAt: "2099-01-01T00:00:00.000Z",
          acceptedHitCount: 3,
        } as OverlayBattleStateV1,
        "active",
      ),
    ).toBe(false);
  });

  it("shows resolving at estimated zero without deriving a terminal outcome", () => {
    expect(
      battleCountdownLabel("2026-10-29T00:00:00.000Z", Date.parse("2026-10-29T00:00:00.000Z")),
    ).toBe("RESOLVING BATTLE");
    expect(overlayBattleView(base)).toBe("active");
  });
});
