import { renderToStaticMarkup } from "react-dom/server";
import { FORGE_VOTE_CHOICES } from "@bossforge/shared";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ live: null as unknown, battle: null as unknown }));
vi.mock("./hooks/useLiveEvents.js", () => ({ useLiveEvents: () => mocks.live }));
vi.mock("./hooks/useBattleState.js", () => ({ useBattleState: () => mocks.battle }));
import { Dashboard, OverlayPreview } from "./App.js";

const forge = {
  serverInstanceId: "s",
  serverStartedAt: "2026-10-29T00:00:00.000Z",
  revision: 4,
  cycleId: "forge-1",
  status: "revealed",
  mode: "mock",
  simulated: true,
  connectedToTwitch: false,
  durationSeconds: 15,
  startedAt: "2026-10-29T00:00:00.000Z",
  activeCategory: null,
  progress: 4,
  categories: (["body", "element", "special", "weakness"] as const).map((category) => {
    const winners = { body: "golem", element: "fire", special: "ember-burst", weakness: "water" };
    return {
      category,
      status: "closed",
      options: FORGE_VOTE_CHOICES[category].map((choice) => ({
        choice,
        count: choice === winners[category] ? 1 : 0,
        percentage: choice === winners[category] ? 100 : 0,
      })),
      totalVotes: 1,
      openedAt: null,
      closesAt: null,
      winner: winners[category],
      noVoteFallback: false,
    };
  }),
  boss: {
    id: "b",
    name: "Test Boss",
    attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
    stats: { health: 100, damage: 10, attackIntervalMs: 1000 },
  },
} as never;
const readyBattle = {
  schemaVersion: 1,
  serverInstanceId: "s",
  serverStartedAt: "2026-10-29T00:00:00.000Z",
  revision: 1,
  status: "ready",
  forgeIdentity: {
    serverInstanceId: "s",
    serverStartedAt: "2026-10-29T00:00:00.000Z",
    cycleId: "forge-1",
    mode: "mock",
  },
  encounterId: "enc-1",
  forgeCycleId: "forge-1",
  bossSnapshot: {
    id: "b",
    name: "Test Boss",
    attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
  },
  profileId: "generic",
  profileVersion: 1,
  profileSnapshot: {},
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
};
const activeBattle = {
  ...readyBattle,
  revision: 2,
  status: "active",
  audienceBand: "low",
  durationSeconds: 60,
  startedAt: "2026-10-29T00:00:00.000Z",
  deadlineAt: "2026-10-29T00:01:00.000Z",
  currentHp: 100,
  maxHp: 100,
};

describe("M2-A battle dashboard projection", () => {
  it("shows owner Start Battle only for a fresh ready battle matching the revealed forge", () => {
    mocks.live = {
      forge,
      connection: "connected",
      snapshotAvailable: true,
      post: vi.fn(),
      error: "",
      notice: "",
      activity: null,
    };
    mocks.battle = { state: readyBattle, fresh: true, error: "", mutate: vi.fn() };
    const html = renderToStaticMarkup(<Dashboard />);
    expect(html).toContain("BATTLE READY");
    expect(html).toContain("Start Battle");
    expect(html).toContain("M2-B · SERVER-VALIDATED CHAT ATTACKS");
  });
  it("keeps Start Battle controls out of the OBS overlay", () => {
    mocks.live = {
      forge,
      connection: "connected",
      snapshotAvailable: true,
      post: vi.fn(),
      error: "",
      notice: "",
      activity: null,
    };
    mocks.battle = { state: readyBattle, fresh: true, error: "", mutate: vi.fn() };
    expect(renderToStaticMarkup(<OverlayPreview />)).not.toContain("Start Battle");
  });

  it("shows attack syntax only for a fresh active dashboard encounter", () => {
    mocks.live = {
      forge,
      connection: "connected",
      snapshotAvailable: true,
      post: vi.fn(),
      error: "",
      notice: "",
      activity: null,
    };
    mocks.battle = {
      state: activeBattle,
      fresh: true,
      error: "",
      activity: null,
      mutate: vi.fn(),
    };
    const dashboard = renderToStaticMarkup(<Dashboard />);
    expect(dashboard).toContain("Attack in chat:");
    expect(dashboard).toContain("!hit water");
    expect(dashboard).toContain("SIMULATED");
    const overlay = renderToStaticMarkup(<OverlayPreview />);
    expect(overlay).not.toContain("Attack in chat:");
    expect(overlay).not.toContain("Start Battle");
    expect(overlay).not.toContain("Cancel encounter");
  });
});
