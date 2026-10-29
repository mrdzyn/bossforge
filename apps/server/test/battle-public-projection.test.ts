import { describe, expect, it } from "vitest";
import type WebSocket from "ws";
import { DashboardEventEnvelopeSchema, OverlayEventEnvelopeSchema } from "@bossforge/shared";
import { EventHub } from "../src/events/event-hub.js";

describe("battle public projection", () => {
  it("projects strict state to dashboard and overlay without sentinel fields", () => {
    const hub = new EventHub();
    const frames: string[] = [];
    const socket = {
      readyState: 1,
      send: (frame: string) => frames.push(frame),
    } as unknown as WebSocket;
    const state = {
      schemaVersion: 1,
      serverInstanceId: "server",
      serverStartedAt: "2026-10-29T00:00:00.000Z",
      revision: 0,
      status: "idle",
      encounterId: null,
      forgeCycleId: null,
      bossSnapshot: null,
      profileId: null,
      profileVersion: null,
      profileSnapshot: null,
      audienceBand: null,
      durationSeconds: null,
      startedAt: null,
      deadlineAt: null,
      currentHp: null,
      maxHp: null,
      acceptedHitCount: 0,
      baseHitCount: 0,
      weaknessHitCount: 0,
      damageApplied: 0,
      cancelReason: null,
      viewerId: "private-viewer-sentinel",
      displayName: "private-name-sentinel",
      text: "private-chat-sentinel",
      token: "private-token-sentinel",
    } as never;
    hub.sendDashboard(socket, { kind: "battle.state", state });
    hub.sendOverlay(socket, { kind: "battle.state", state });
    expect(frames).toHaveLength(2);
    const dashboard = JSON.parse(frames[0]!);
    const overlay = JSON.parse(frames[1]!);
    const dashboardEvent = DashboardEventEnvelopeSchema.parse(dashboard);
    const overlayEvent = OverlayEventEnvelopeSchema.parse(overlay);
    expect(dashboardEvent.type).toBe("battle.state");
    expect(overlayEvent.type).toBe("battle.state");
    if (dashboardEvent.type === "battle.state")
      expect(dashboardEvent.payload.state).toHaveProperty("profileSnapshot");
    if (overlayEvent.type === "battle.state")
      expect(overlayEvent.payload.state).not.toHaveProperty("profileSnapshot");
    expect(frames.join(" ")).not.toMatch(/private-(viewer|name|chat|token)-sentinel/);
  });
});
