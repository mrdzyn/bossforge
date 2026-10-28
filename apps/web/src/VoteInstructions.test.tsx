import { renderToStaticMarkup } from "react-dom/server";
import type { ForgeCategoryState } from "@bossforge/shared";
import { describe, expect, it } from "vitest";
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

describe("vote instructions presentation", () => {
  it("shows exact category commands and human-readable choices for live chat", () => {
    const html = renderToStaticMarkup(
      <VoteInstructions
        category={bodyCategory}
        mode="twitch"
        connectedToTwitch={true}
        surface="overlay"
      />,
    );
    expect(html).toContain("Vote in Twitch chat");
    expect(html).toContain("!vote body &lt;choice&gt;");
    expect(html).toContain("!vote body golem");
    expect(html).toContain("!vote body drake");
    expect(html).toContain("Golem");
    expect(html).toContain("Drake");
  });

  it("clearly labels simulation and never implies live Twitch voting", () => {
    const html = renderToStaticMarkup(
      <VoteInstructions
        category={bodyCategory}
        mode="mock"
        connectedToTwitch={false}
        surface="overlay"
      />,
    );
    expect(html).toContain("SIMULATED");
    expect(html).not.toContain("Vote in Twitch chat");
    expect(html).not.toContain("!vote body golem");
  });

  it("labels a disconnected Twitch session and does not solicit a vote", () => {
    const html = renderToStaticMarkup(
      <VoteInstructions
        category={bodyCategory}
        mode="twitch"
        connectedToTwitch={false}
        surface="overlay"
      />,
    );
    expect(html).toContain("Twitch disconnected");
    expect(html).not.toContain("!vote body golem");
  });

  it("renders read-only command text without vote submission controls", () => {
    const html = renderToStaticMarkup(
      <VoteInstructions
        category={bodyCategory}
        mode="twitch"
        connectedToTwitch={true}
        surface="overlay"
      />,
    );
    expect(html).not.toMatch(/<(?:button|form|input)\b/i);
  });
});
