import { renderToStaticMarkup } from "react-dom/server";
import type { ForgeCategoryState } from "@bossforge/shared";
import { describe, expect, it } from "vitest";
import { LiveVoteSurface } from "./LiveVoteSurface.js";
import { VoteInstructions } from "./VoteInstructions.js";

const bodyCategory: ForgeCategoryState = {
  category: "body",
  status: "open",
  options: [
    { choice: "golem", count: 2, percentage: 50 },
    { choice: "drake", count: 2, percentage: 50 },
  ],
  totalVotes: 4,
  openedAt: "2026-10-27T00:00:00.000Z",
  closesAt: "2026-10-27T00:00:15.000Z",
  winner: null,
  noVoteFallback: false,
};

function renderVoteSurface({
  connection = "connected",
  snapshotAvailable = true,
  mode = "twitch",
  connectedToTwitch = true,
  surface = "dashboard",
}: {
  connection?: string;
  snapshotAvailable?: boolean;
  mode?: "mock" | "twitch";
  connectedToTwitch?: boolean;
  surface?: "dashboard" | "overlay";
} = {}) {
  return renderToStaticMarkup(
    <LiveVoteSurface
      connection={connection}
      snapshotAvailable={snapshotAvailable}
      surface={surface}
    >
      <section aria-label="Current forge voting state">
        <strong>BODY VOTING NOW</strong>
        <span>{bodyCategory.totalVotes} votes</span>
        <span>15 seconds remaining</span>
        <VoteInstructions
          category={bodyCategory}
          mode={mode}
          connectedToTwitch={connectedToTwitch}
          surface={surface}
        />
      </section>
    </LiveVoteSurface>,
  );
}

describe("dashboard and overlay live vote state composition", () => {
  it("shows live commands only with a connected server feed and fresh verified Twitch state", () => {
    const html = renderVoteSurface();
    expect(html).toContain("BODY VOTING NOW");
    expect(html).toContain("Vote in Twitch chat");
    expect(html).toContain("!vote body drake");
    expect(html).toContain("4 votes");
    expect(html).toContain("15 seconds remaining");
  });

  it("hides cached live commands, counts, and countdown after the local WebSocket is lost", () => {
    const html = renderVoteSurface({ connection: "disconnected" });
    expect(html).toContain("SERVER LINK UNAVAILABLE");
    expect(html).toContain("LIVE VOTE STATUS UNKNOWN");
    expect(html).not.toContain("Vote in Twitch chat");
    expect(html).not.toContain("!vote body drake");
    expect(html).not.toContain("4 votes");
    expect(html).not.toContain("15 seconds remaining");
  });

  it("does not trust a cached Twitch-connected forge snapshot", () => {
    const cachedConnectedForge = renderVoteSurface({
      connection: "error",
      snapshotAvailable: false,
    });
    expect(cachedConnectedForge).toContain("SERVER LINK UNAVAILABLE");
    expect(cachedConnectedForge).not.toContain("TWITCH CONNECTED");
    expect(cachedConnectedForge).not.toContain("!vote body drake");
  });

  it("keeps voting unknown when the HTTP state refresh is unavailable", () => {
    const html = renderVoteSurface({ snapshotAvailable: false });
    expect(html).toContain("WAITING FOR FRESH SERVER STATE");
    expect(html).toContain("LIVE VOTE STATUS UNKNOWN");
    expect(html).not.toContain("BODY VOTING NOW");
    expect(html).not.toContain("4 votes");
    expect(html).not.toContain("!vote body drake");
  });

  it("restores the current live prompt after a fresh state is reconciled on reconnect", () => {
    const html = renderVoteSurface({ connection: "connected", snapshotAvailable: true });
    expect(html).toContain("BODY VOTING NOW");
    expect(html).toContain("!vote body drake");
  });

  it("distinguishes a fresh authoritative Twitch disconnect from local server loss", () => {
    const html = renderVoteSurface({ connectedToTwitch: false });
    expect(html).toContain("Twitch disconnected");
    expect(html).not.toContain("SERVER LINK UNAVAILABLE");
    expect(html).not.toContain("!vote body drake");
  });

  it("keeps mock voting labeled simulated and never shows Twitch commands", () => {
    const html = renderVoteSurface({ mode: "mock", connectedToTwitch: false });
    expect(html).toContain("SIMULATED");
    expect(html).not.toContain("Vote in Twitch chat");
    expect(html).not.toContain("!vote body drake");
  });

  it("keeps the overlay presentational with no administration or vote controls", () => {
    const html = renderVoteSurface({ surface: "overlay" });
    expect(html).toContain("!vote body drake");
    expect(html).not.toMatch(/<(?:button|form|input)\b/i);
  });
});
