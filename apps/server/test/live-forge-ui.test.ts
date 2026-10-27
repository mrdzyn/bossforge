import { describe, expect, it } from "vitest";
import type { ForgeState } from "@bossforge/shared";
import {
  FORGE_DURATIONS,
  forgeCountdownLabel,
  isTwitchVoteCancelled,
  sanitizedForgeStartError,
} from "../../web/src/live-forge-ui.js";

const forgeState = (state: Partial<ForgeState>) => state as ForgeState;

describe("live forge dashboard state helpers", () => {
  it("offers the supported category durations and labels the active countdown", () => {
    expect(FORGE_DURATIONS).toEqual([15, 30, 60]);
    expect(forgeCountdownLabel("special", 12)).toBe("SPECIAL · 12s");
  });

  it("identifies a Twitch loss that cancels an active cycle, but ignores unrelated states", () => {
    const voting = forgeState({ mode: "twitch", connectedToTwitch: true, status: "voting" });
    const canceled = forgeState({
      mode: "twitch",
      connectedToTwitch: false,
      status: "idle",
      activeCategory: null,
    });
    expect(isTwitchVoteCancelled(voting, canceled)).toBe(true);
    expect(
      isTwitchVoteCancelled(voting, forgeState({ ...canceled, connectedToTwitch: true })),
    ).toBe(false);
    expect(isTwitchVoteCancelled(null, canceled)).toBe(false);
  });

  it("maps start failures to fixed sanitized guidance", () => {
    expect(sanitizedForgeStartError(401)).toContain("owner session");
    expect(sanitizedForgeStartError(403)).toContain("localhost:5173");
    expect(sanitizedForgeStartError(409, "Twitch EventSub is not connected")).toContain(
      "Twitch is disconnected",
    );
    expect(sanitizedForgeStartError(409, "A forge cycle is already active")).toContain(
      "already active",
    );
    expect(sanitizedForgeStartError(418, "secret-bearing unknown detail")).toBe(
      "The forge request failed (HTTP 418). Try again or check the local server.",
    );
  });
});
