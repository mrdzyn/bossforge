import { renderToStaticMarkup } from "react-dom/server";
import type { ForgeState } from "@bossforge/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedHook = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./hooks/useLiveEvents.js", () => ({
  useLiveEvents: () => mockedHook.value,
}));

import { Dashboard, OverlayPreview } from "./App.js";

const makeState = (mode: "mock" | "twitch" = "twitch", connectedToTwitch = true): ForgeState => {
  const choices = {
    body: ["golem", "drake"],
    element: ["fire", "ice"],
    special: ["ember-burst", "thunder-dash"],
    weakness: ["water", "earth"],
  } as const;
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
        percentage: index === 0 ? 75 : 25,
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

function installHookState({
  connection = "connected",
  snapshotAvailable = true,
  forge = makeState(),
}: {
  connection?: string;
  snapshotAvailable?: boolean;
  forge?: ForgeState | null;
} = {}) {
  mockedHook.value = {
    activity: {
      accepted: 2,
      rejected: 0,
      reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
    },
    forge,
    connection,
    error: "",
    notice: "",
    snapshotAvailable,
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
});
