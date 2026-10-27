import { describe, expect, it } from "vitest";
import { FORGE_VOTE_CHOICES } from "../src/index.js";
import {
  humanizeVoteChoice,
  currentVoteLeader,
  remainingVoteSeconds,
  voteCommand,
  voteCommands,
  winnerAttribution,
} from "../src/voting-presentation.js";

describe("voting presentation helpers", () => {
  it("formats the exact accepted command syntax", () => {
    expect(voteCommand("body", "drake")).toBe("!vote body drake");
    expect(voteCommand("special", "ember-burst")).toBe("!vote special ember-burst");
  });

  it("uses only the canonical choices for each category", () => {
    for (const category of ["body", "element", "special", "weakness"] as const) {
      expect(voteCommands(category)).toEqual(
        FORGE_VOTE_CHOICES[category].map((choice) => `!vote ${category} ${choice}`),
      );
    }
  });

  it("keeps hyphenated machine values in commands and humanizes labels", () => {
    expect(voteCommands("special")[0]).toBe("!vote special ember-burst");
    expect(humanizeVoteChoice("ember-burst")).toBe("Ember Burst");
  });

  it("computes an authoritative countdown from the category close time", () => {
    const closeMs = Date.parse("2026-01-01T00:00:10.000Z");
    expect(remainingVoteSeconds("2026-01-01T00:00:10.000Z", closeMs - 9_001)).toBe(10);
    expect(remainingVoteSeconds("2026-01-01T00:00:10.000Z", closeMs - 1)).toBe(1);
    expect(remainingVoteSeconds("2026-01-01T00:00:10.000Z", closeMs)).toBe(0);
    expect(remainingVoteSeconds(null, closeMs)).toBe(0);
  });

  it("distinguishes a community winner from a no-vote default", () => {
    expect(winnerAttribution("drake", false)).toBe("COMMUNITY VOTE · Drake was selected.");
    expect(winnerAttribution("ember-burst", true)).toBe(
      "DEFAULT · No valid votes; Ember Burst was selected.",
    );
    expect(winnerAttribution(null, false)).toBeNull();
  });

  it("reports only a current leader or tie and no leader before votes arrive", () => {
    expect(
      currentVoteLeader([
        { choice: "drake", count: 2 },
        { choice: "golem", count: 1 },
      ]),
    ).toEqual({
      status: "leader",
      choice: "drake",
      count: 2,
    });
    expect(
      currentVoteLeader([
        { choice: "drake", count: 2 },
        { choice: "golem", count: 2 },
      ]),
    ).toEqual({
      status: "tied",
      count: 2,
    });
    expect(
      currentVoteLeader([
        { choice: "drake", count: 0 },
        { choice: "golem", count: 0 },
      ]),
    ).toBeNull();
  });
});
