import { renderToStaticMarkup } from "react-dom/server";
import { FORGE_VOTE_CHOICES, type DashboardActivity, type ForgeState } from "@bossforge/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedHook = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./hooks/useLiveEvents.js", () => ({
  useLiveEvents: () => mockedHook.value,
}));

import { Dashboard, OverlayPreview } from "./App.js";

const makeState = (mode: "mock" | "twitch" = "twitch", connectedToTwitch = true): ForgeState => {
  const choices = FORGE_VOTE_CHOICES;
  return {
    serverInstanceId: "test-server",
    serverStartedAt: "2026-10-27T00:00:00.000Z",
    revision: 1,
    cycleId: "test-cycle",
    status: "voting",
    mode,
    simulated: mode === "mock",
    connectedToTwitch: mode === "twitch" && connectedToTwitch,
    durationSeconds: 15,
    startedAt: "2026-10-27T00:00:00.000Z",
    activeCategory: "body",
    progress: 0,
    categories: (["body", "element", "special", "weakness"] as const).map((category) => ({
      category,
      status: category === "body" ? "open" : "pending",
      options: choices[category].map((choice, index) => ({
        choice,
        count: index === 0 ? 3 : 1,
        percentage: index === 0 ? 75 : index === 1 ? 25 : 0,
      })),
      totalVotes: 4,
      openedAt: category === "body" ? "2026-10-27T00:00:00.000Z" : null,
      closesAt: category === "body" ? "2026-10-27T00:00:15.000Z" : null,
      winner: null,
      noVoteFallback: false,
    })),
    boss: null,
  } as ForgeState;
};

const makeReveal = (mode: "mock" | "twitch" = "mock", connectedToTwitch = false): ForgeState => {
  const state = makeState(mode, connectedToTwitch);
  return {
    ...state,
    status: "revealed",
    activeCategory: null,
    progress: 4,
    categories: state.categories.map((category) => {
      const usedDefault = category.category === "special";
      const winner =
        category.category === "weakness" ? "earth" : (category.options[0]?.choice ?? null);
      return {
        ...category,
        status: "closed",
        options: category.options.map((option) => ({
          ...option,
          count: usedDefault ? 0 : option.choice === winner ? 3 : option.count ? 1 : 0,
          percentage: usedDefault ? 0 : option.choice === winner ? 75 : option.count ? 25 : 0,
        })),
        totalVotes: usedDefault ? 0 : category.totalVotes,
        winner,
        noVoteFallback: usedDefault,
      };
    }),
    boss: {
      id: "test-cycle",
      name: "Cinder Granite",
      attributes: {
        body: "golem",
        element: "fire",
        special: "ember-burst",
        weakness: "earth",
      },
      stats: { health: 250, damage: 24, attackIntervalMs: 1600 },
    },
  } as ForgeState;
};

const makeIdle = (): ForgeState =>
  ({
    ...makeState("mock", false),
    cycleId: null,
    status: "idle",
    startedAt: null,
    activeCategory: null,
    progress: 0,
    categories: makeState("mock", false).categories.map((category) => ({
      ...category,
      status: "pending",
      totalVotes: 0,
      openedAt: null,
      closesAt: null,
      winner: null,
    })),
    boss: null,
  }) as ForgeState;

function installHookState({
  connection = "connected",
  snapshotAvailable = true,
  forge = makeState(),
  activity,
}: {
  connection?: string;
  snapshotAvailable?: boolean;
  forge?: ForgeState | null;
  activity?: DashboardActivity | null;
} = {}) {
  mockedHook.value = {
    activity:
      activity === undefined
        ? {
            serverInstanceId: forge?.serverInstanceId ?? "test-server",
            cycleId: forge?.cycleId ?? null,
            accepted: 2,
            rejected: 0,
            reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
          }
        : activity,
    forge,
    connection,
    error: "",
    notice: "",
    snapshotAvailable,
    overlayBattle: null,
    overlayBattleFresh: true,
    post: vi.fn(async () => true),
  };
}

describe("actual dashboard and overlay live state composition", () => {
  beforeEach(() => installHookState());

  it("renders live commands only for fresh authoritative connected Twitch state", () => {
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("Vote in Twitch chat");
      expect(html).toContain("!vote body drake");
    }
    expect(dashboard).toContain("4 votes cast");
    expect(overlay).toContain("75% · 3");
  });

  it("removes cached commands, totals, countdown, and leader after WebSocket loss", () => {
    installHookState({ connection: "disconnected", snapshotAvailable: false });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("SERVER LINK UNAVAILABLE");
      expect(html).toContain("LIVE VOTE STATUS UNKNOWN");
      expect(html).not.toContain("!vote body drake");
      expect(html).not.toContain("Leading right now");
      expect(html).not.toContain("15s");
    }
    expect(dashboard).toContain("Vote total unknown");
    expect(dashboard).toContain("Vote activity unknown");
    expect(dashboard).toContain("LOCAL SERVER UNAVAILABLE · TWITCH STATUS UNKNOWN");
    expect(dashboard).toContain("STATUS UNKNOWN");
    expect(dashboard).not.toContain("Authorize Twitch");
    expect(dashboard).not.toContain("accepted votes</span>");
    expect(dashboard).not.toContain("<strong>2</strong>");
  });

  it("keeps an HTTP refresh failure unknown while the socket is open", () => {
    installHookState({ snapshotAvailable: false });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("WAITING FOR FRESH SERVER STATE");
      expect(html).toContain("LIVE VOTE STATUS UNKNOWN");
      expect(html).not.toContain("!vote body drake");
      expect(html).not.toContain("4 votes");
    }
    expect(dashboard).toContain("Vote activity unknown");
  });

  it("hides aggregates from another server epoch or forge cycle", () => {
    const current = makeState();
    installHookState({
      forge: current,
      activity: {
        serverInstanceId: "retired-server",
        cycleId: "retired-cycle",
        accepted: 99,
        rejected: 88,
        reasons: { invalid: 77, duplicate: 0, inactive: 0, other: 0 },
      },
    });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    expect(dashboard).toContain("Vote activity unknown");
    expect(dashboard).not.toContain("99");
    expect(dashboard).not.toContain("88");
  });

  it("restores prompts only after fresh state is reconciled following reconnect", () => {
    installHookState({ connection: "connected", snapshotAvailable: true, forge: makeState() });
    expect(renderToStaticMarkup(<Dashboard />)).toContain("!vote body drake");
    expect(renderToStaticMarkup(<OverlayPreview />)).toContain("!vote body drake");
  });

  it("shows Twitch disconnected from fresh server state without conflating it with server loss", () => {
    installHookState({ forge: makeState("twitch", false) });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("Twitch disconnected");
      expect(html).not.toContain("SERVER LINK UNAVAILABLE");
      expect(html).not.toContain("!vote body drake");
    }
  });

  it("keeps mock mode explicitly simulated", () => {
    installHookState({ forge: makeState("mock", false) });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("SIMULATED");
      expect(html).not.toContain("Vote in Twitch chat");
      expect(html).not.toContain("!vote body drake");
    }
  });

  it("keeps the actual OBS overlay read-only", () => {
    installHookState();
    const html = renderToStaticMarkup(<OverlayPreview />);
    expect(html).toContain("!vote body drake");
    expect(html).not.toMatch(/<(?:button|form|input)\b/i);
  });

  it("shows the generic idle state without inventing a boss or battle controls", () => {
    installHookState({ forge: makeIdle() });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    expect(dashboard).toContain("GENERIC / OBS");
    expect(dashboard).toContain("Ready to forge");
    expect(dashboard).toContain("Chat fights the boss");
    expect(dashboard).toContain("Chat creates the boss. Chat fights the boss.");
    expect(dashboard).toContain("does not read, control, or integrate with the game");
    expect(overlay).toContain("AWAITING FORGE");
    expect(overlay).not.toContain("BATTLE READY");
    expect(overlay).not.toContain("BATTLE COMING SOON");
  });

  it("renders only a complete authoritative four-stage reveal with safe traits and attribution", () => {
    installHookState({ forge: makeReveal() });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("Cinder Granite");
      expect(html).toContain("WAITING FOR VERIFIED BATTLE STATE");
      expect(html).toContain("Golem");
      expect(html).toContain("Fire");
      expect(html).toContain("Ember Burst");
      expect(html).toContain("Earth");
      expect(html).not.toContain("BATTLE READY");
      expect(html).not.toContain("Start Battle");
      expect(html).not.toContain("!hit");
      expect(html).not.toContain("250 HP");
      expect(html).not.toContain("24 DMG");
    }
    const inlineStatus = dashboard.indexOf(
      '<span class="reveal-inline-status" role="status">WAITING FOR VERIFIED BATTLE STATE</span>',
    );
    const bossArtwork = dashboard.indexOf('class="boss-art');
    expect(inlineStatus).toBeGreaterThanOrEqual(0);
    expect(inlineStatus).toBeLessThan(bossArtwork);
    expect(overlay).toContain("COMMUNITY VOTE");
    expect(overlay).toContain("DEFAULT · No valid votes");
    expect(overlay).toContain("OBS BROWSER SOURCE");
    expect(overlay).not.toMatch(/<(?:button|form|input)\b/i);
    expect(dashboard).toContain("Optional Arena demo");
    expect(dashboard).toContain("Separate local Phaser demo");
  });

  it("does not present incomplete or malformed reveal snapshots as a boss", () => {
    const valid = makeReveal();
    const invalid = [
      { ...valid, boss: null },
      { ...valid, cycleId: null },
      { ...valid, progress: 3 },
      {
        ...valid,
        categories: valid.categories.map((category, index) =>
          index === 2 ? { ...category, status: "open" as const } : category,
        ),
      },
    ];
    for (const forge of invalid) {
      installHookState({ forge: forge as ForgeState });
      const dashboard = renderToStaticMarkup(<Dashboard />);
      const overlay = renderToStaticMarkup(<OverlayPreview />);
      for (const html of [dashboard, overlay]) {
        expect(html).not.toContain("Cinder Granite");
        expect(html).not.toContain("REVEALED — BATTLE COMING SOON");
        expect(html).toContain("WAITING FOR FRESH SERVER STATE");
      }
    }
  });

  it("keeps a fresh Twitch reveal visible but explicitly disconnected after Twitch loss", () => {
    installHookState({ forge: makeReveal("twitch", false) });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    expect(dashboard).toContain("TWITCH DISCONNECTED");
    expect(overlay).toContain("TWITCH DISCONNECTED / VOTING PAUSED");
    expect(overlay).toContain("TWITCH DISCONNECTED");
    expect(overlay).not.toContain("LIVE TWITCH");
  });

  it("renders the server-authored boss name as text rather than markup", () => {
    const forge = makeReveal();
    if (!forge.boss) throw new Error("test reveal needs a boss");
    forge.boss.name = "<script>sentinel</script>";
    installHookState({ forge });
    const dashboard = renderToStaticMarkup(<Dashboard />);
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    for (const html of [dashboard, overlay]) {
      expect(html).toContain("&lt;script&gt;sentinel&lt;/script&gt;");
      expect(html).not.toContain("<script>sentinel</script>");
    }
  });

  it("hides a previous reveal after feed loss and allows only a new fresh reveal after reconnect", () => {
    const priorReveal = makeReveal();
    installHookState({ forge: priorReveal, connection: "disconnected", snapshotAvailable: false });
    const lost = renderToStaticMarkup(<OverlayPreview />);
    expect(lost).toContain("SERVER LINK UNAVAILABLE");
    expect(lost).not.toContain("Cinder Granite");
    expect(lost).not.toContain("REVEALED — BATTLE COMING SOON");

    const freshReveal = makeReveal();
    freshReveal.serverInstanceId = "new-server-instance";
    freshReveal.revision = 0;
    installHookState({ forge: freshReveal, connection: "connected", snapshotAvailable: true });
    const restored = renderToStaticMarkup(<OverlayPreview />);
    expect(restored).toContain("Cinder Granite");
    expect(restored).toContain("WAITING FOR VERIFIED BATTLE STATE");
  });
});
