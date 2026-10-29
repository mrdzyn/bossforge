import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import type { OverlayBattleStateV1 } from "@bossforge/shared";
import { OverlayBattleHud } from "./OverlayBattleHud.js";

const epoch = "2026-10-29T00:00:00.000Z";

function activeBattle(
  encounterId: string,
  acceptedHitCount: number,
  weaknessHitCount: number,
  serverInstanceId = "server-1",
): OverlayBattleStateV1 {
  return {
    schemaVersion: 1,
    serverInstanceId,
    serverStartedAt: epoch,
    revision: acceptedHitCount + 1,
    status: "active",
    forgeIdentity: {
      serverInstanceId,
      serverStartedAt: epoch,
      cycleId: `forge-${encounterId}`,
      mode: "mock",
    },
    encounterId,
    forgeCycleId: `forge-${encounterId}`,
    bossSnapshot: {
      id: `boss-${encounterId}`,
      name: "Cinder Granite",
      attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
    },
    audienceBand: "low",
    durationSeconds: 60,
    startedAt: epoch,
    deadlineAt: "2099-10-29T00:01:00.000Z",
    currentHp: 100 - acceptedHitCount * 8,
    maxHp: 100,
    acceptedHitCount,
    baseHitCount: acceptedHitCount - weaknessHitCount,
    weaknessHitCount,
    damageApplied: acceptedHitCount * 8,
    cancelReason: null,
  } as OverlayBattleStateV1;
}

function terminal(
  state: OverlayBattleStateV1,
  status: "victory" | "cancelled",
): OverlayBattleStateV1 {
  return {
    ...state,
    revision: state.revision + 1,
    status,
    currentHp: status === "victory" ? 0 : state.currentHp,
    cancelReason: status === "cancelled" ? "twitch_disconnected" : null,
  } as OverlayBattleStateV1;
}

describe("OverlayBattleHud mounted animation lifecycle", () => {
  let renderer: ReactTestRenderer | undefined;

  const mount = (
    battle: OverlayBattleStateV1 | null,
    view: "active" | "victory" | "cancelled" | "unavailable",
  ) => {
    renderer = TestRenderer.create(<OverlayBattleHud battle={battle} view={view} simulated />);
  };

  const update = (
    battle: OverlayBattleStateV1 | null,
    view: "active" | "victory" | "cancelled" | "unavailable",
  ) => {
    act(() => renderer!.update(<OverlayBattleHud battle={battle} view={view} simulated />));
  };

  const hudClass = () => renderer!.root.findByType("section").props.className as string;

  beforeEach(() => {
    vi.useFakeTimers();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it("clears hit and weakness effects before a replacement encounter after immediate victory", () => {
    const first = activeBattle("enc-1", 1, 0);
    act(() => mount(first, "active"));
    const hit = activeBattle("enc-1", 2, 1);
    update(hit, "active");
    expect(hudClass()).toContain("is-impact");
    expect(hudClass()).toContain("is-weakness");
    update(terminal(hit, "victory"), "victory");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    update(activeBattle("enc-2", 0, 0), "active");
    expect(hudClass()).not.toContain("is-impact");
    expect(hudClass()).not.toContain("is-weakness");
  });

  it("clears a weakness effect when the active encounter is cancelled", () => {
    const first = activeBattle("enc-1", 1, 0);
    act(() => mount(first, "active"));
    const hit = activeBattle("enc-1", 2, 1);
    update(hit, "active");
    expect(hudClass()).toContain("is-weakness");
    const cancelled = terminal(hit, "cancelled");
    update(cancelled, "cancelled");
    expect(renderer!.root.findByType("strong").children.join(" ")).toBe("BATTLE CANCELLED");
    update(activeBattle("enc-2", 0, 0), "active");
    expect(hudClass()).not.toContain("is-impact");
    expect(hudClass()).not.toContain("is-weakness");
  });

  it("does not replay historical hit effects after server loss and reconnect", () => {
    const historical = activeBattle("enc-1", 4, 2);
    act(() => mount(historical, "active"));
    update(null, "unavailable");
    expect(renderer!.root.findByType("section").props.className).toContain("m2c-unavailable");
    update(historical, "active");
    expect(hudClass()).not.toContain("is-impact");
    expect(hudClass()).not.toContain("is-weakness");
  });

  it("clears both effects immediately when the server epoch changes", () => {
    const first = activeBattle("enc-1", 1, 0);
    act(() => mount(first, "active"));
    const hit = activeBattle("enc-1", 2, 1);
    update(hit, "active");
    expect(hudClass()).toContain("is-impact");
    expect(hudClass()).toContain("is-weakness");
    update(
      {
        ...activeBattle("enc-1", 5, 2, "server-2"),
        serverStartedAt: "2026-10-30T00:00:00.000Z",
        forgeIdentity: {
          serverInstanceId: "server-2",
          serverStartedAt: "2026-10-30T00:00:00.000Z",
          cycleId: "forge-enc-1",
          mode: "mock",
        },
      } as OverlayBattleStateV1,
      "active",
    );
    expect(hudClass()).not.toContain("is-impact");
    expect(hudClass()).not.toContain("is-weakness");
  });

  it("suppresses impact animations when reduced motion is requested", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    const first = activeBattle("enc-1", 1, 0);
    act(() => mount(first, "active"));
    update(activeBattle("enc-1", 2, 1), "active");
    expect(hudClass()).not.toContain("is-impact");
    expect(hudClass()).not.toContain("is-weakness");
  });
});
