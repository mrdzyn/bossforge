import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import {
  FORGE_VOTE_CHOICES,
  OverlayBattleStateV1Schema,
  PublicForgeStateSchema,
  type OverlayBattleStateV1,
  type PublicForgeState,
} from "@bossforge/shared";
import { overlayBattleView } from "../overlay-battle-presentation.js";
import { useLiveEvents } from "./useLiveEvents.js";

const startTime = "2026-10-29T00:00:00.000Z";

function forgeSnapshot(
  serverInstanceId = "server-g1",
  serverStartedAt = startTime,
  cycleId: string | null = "forge-1",
  status: "idle" | "revealed" = "revealed",
): PublicForgeState {
  const categories = (Object.keys(FORGE_VOTE_CHOICES) as (keyof typeof FORGE_VOTE_CHOICES)[]).map(
    (category) => {
      const winner = FORGE_VOTE_CHOICES[category][0]!;
      return {
        category,
        status: "closed" as const,
        options: FORGE_VOTE_CHOICES[category].map((choice) => ({
          choice,
          count: choice === winner ? 1 : 0,
          percentage: choice === winner ? 100 : 0,
        })),
        totalVotes: 1,
        openedAt: startTime,
        closesAt: startTime,
        winner,
        noVoteFallback: false,
      };
    },
  );
  return PublicForgeStateSchema.parse({
    serverInstanceId,
    serverStartedAt,
    revision: status === "idle" ? 0 : 4,
    cycleId,
    status,
    mode: "mock",
    simulated: true,
    connectedToTwitch: false,
    durationSeconds: 15,
    startedAt: status === "idle" ? null : startTime,
    activeCategory: null,
    progress: status === "idle" ? 0 : 4,
    categories,
    boss:
      status === "idle"
        ? null
        : {
            id: cycleId,
            name: "Test Granite",
            attributes: {
              body: "golem",
              element: "fire",
              special: "ember-burst",
              weakness: "water",
            },
            stats: { health: 120, damage: 12, attackIntervalMs: 1800 },
          },
  });
}

function battleSnapshot(
  serverInstanceId = "server-g1",
  serverStartedAt = startTime,
  forgeCycleId = "forge-1",
  encounterId = "enc-g1",
  revision = 3,
  currentHp = 72,
): OverlayBattleStateV1 {
  return OverlayBattleStateV1Schema.parse({
    schemaVersion: 1,
    serverInstanceId,
    serverStartedAt,
    revision,
    status: "active",
    forgeIdentity: { serverInstanceId, serverStartedAt, cycleId: forgeCycleId, mode: "mock" },
    encounterId,
    forgeCycleId,
    bossSnapshot: {
      id: forgeCycleId,
      name: "Test Granite",
      attributes: { body: "golem", element: "fire", special: "ember-burst", weakness: "water" },
    },
    audienceBand: "low",
    durationSeconds: 60,
    startedAt: startTime,
    deadlineAt: "2099-10-29T00:01:00.000Z",
    currentHp,
    maxHp: 100,
    acceptedHitCount: 2,
    baseHitCount: 1,
    weaknessHitCount: 1,
    damageApplied: 28,
    cancelReason: null,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

type DeferredResponse = ReturnType<typeof deferred<Response>>;

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;

  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

describe("useLiveEvents overlay HTTP freshness fencing", () => {
  let renderer: ReactTestRenderer | undefined;
  let forgeResponses: PublicForgeState[];
  let battleResponses: DeferredResponse[];
  let battleSignals: AbortSignal[];
  let observed = "";

  function Probe() {
    const live = useLiveEvents("overlay");
    const view = overlayBattleView({
      connection: live.connection,
      forgeFresh: live.snapshotAvailable,
      battleFresh: live.overlayBattleFresh,
      forge: live.forge,
      battle: live.overlayBattle,
    });
    observed = `${view}|${live.overlayBattle?.currentHp ?? "hidden"}|${live.overlayBattleFresh}`;
    return createElement("output", null, observed);
  }

  async function settle() {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  }

  async function mountWithDeferredFetch() {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    forgeResponses = [forgeSnapshot()];
    battleResponses = [];
    battleSignals = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:5173" });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/forge/state")
          return Promise.resolve(response(forgeResponses.shift() ?? forgeSnapshot()));
        const request = deferred<Response>();
        battleResponses.push(request);
        battleSignals.push(init?.signal as AbortSignal);
        return request.promise;
      }),
    );
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {
      renderer = TestRenderer.create(createElement(Probe));
      await settle();
    });
    await act(async () => {
      FakeWebSocket.instances[0]!.open();
      await settle();
    });
  }

  async function resolveBattleRequest(index: number, state: OverlayBattleStateV1, status = 200) {
    await act(async () => {
      battleResponses[index]!.resolve(response(state, status));
      await settle();
    });
  }

  beforeEach(() => {
    forgeResponses = [];
    battleResponses = [];
    observed = "";
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it("does not restore HP when older A succeeds after newer B fails", async () => {
    await mountWithDeferredFetch();
    expect(battleResponses).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
    });
    expect(battleResponses).toHaveLength(2);
    await resolveBattleRequest(1, battleSnapshot(), 503);
    expect(observed).toContain("unavailable|hidden|false");
    await resolveBattleRequest(0, battleSnapshot());
    expect(observed).toContain("unavailable|hidden|false");
    expect(observed).not.toContain("72");
  });

  it("does not invalidate fresh B when older A fails afterward", async () => {
    await mountWithDeferredFetch();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
    });
    await resolveBattleRequest(
      1,
      battleSnapshot("server-g1", startTime, "forge-1", "enc-g1", 4, 61),
    );
    expect(observed).toContain("active|61|true");
    await act(async () => {
      battleResponses[0]!.reject(new Error("retired request failure"));
      await settle();
    });
    expect(observed).toContain("active|61|true");
  });

  it("keeps the newer snapshot when overlapping same-generation responses resolve out of order", async () => {
    await mountWithDeferredFetch();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
    });
    await resolveBattleRequest(
      1,
      battleSnapshot("server-g1", startTime, "forge-1", "enc-g1", 4, 55),
    );
    await resolveBattleRequest(
      0,
      battleSnapshot("server-g1", startTime, "forge-1", "enc-g1", 3, 72),
    );
    expect(observed).toContain("active|55|true");
  });

  it("bounds simultaneous overlay snapshot requests while earlier fetches remain pending", async () => {
    await mountWithDeferredFetch();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await settle();
    });
    expect(battleResponses).toHaveLength(2);
  });

  it("rejects G1 HTTP after G2 reconnect/backend restart and restores only G2 authority", async () => {
    await mountWithDeferredFetch();
    const oldSocket = FakeWebSocket.instances[0]!;
    const newStartedAt = "2026-10-30T00:00:00.000Z";
    forgeResponses = [forgeSnapshot("server-g2", newStartedAt)];
    await act(async () => {
      oldSocket.close();
      await vi.advanceTimersByTimeAsync(1200);
      await settle();
    });
    const newSocket = FakeWebSocket.instances[1]!;
    await act(async () => {
      newSocket.open();
      await settle();
    });
    await resolveBattleRequest(
      1,
      battleSnapshot("server-g2", newStartedAt, "forge-1", "enc-g2", 1, 88),
    );
    expect(observed).toContain("active|88|true");
    await resolveBattleRequest(
      0,
      battleSnapshot("server-g1", startTime, "forge-1", "enc-g1", 9, 1),
    );
    expect(observed).toContain("active|88|true");
  });

  it("adopts G2 while both G1 snapshots hang and fences their later completions", async () => {
    await mountWithDeferredFetch();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
    });
    expect(battleResponses).toHaveLength(2);

    const newStartedAt = "2026-10-30T00:00:00.000Z";
    forgeResponses = [forgeSnapshot("server-g2", newStartedAt)];
    await act(async () => {
      FakeWebSocket.instances[0]!.close();
      await vi.advanceTimersByTimeAsync(1200);
      await settle();
      FakeWebSocket.instances[1]!.open();
      await settle();
    });

    // G2 receives a request immediately although neither aborted G1 fetch has settled.
    expect(battleResponses).toHaveLength(3);
    expect(battleSignals[0]?.aborted).toBe(true);
    expect(battleSignals[1]?.aborted).toBe(true);
    await resolveBattleRequest(
      2,
      battleSnapshot("server-g2", newStartedAt, "forge-1", "enc-g2", 1, 88),
    );
    expect(observed).toContain("active|88|true");

    await act(async () => {
      battleResponses[0]!.resolve(
        response(battleSnapshot("server-g1", startTime, "forge-1", "enc-g1", 99, 1)),
      );
      battleResponses[1]!.reject(new Error("retired G1 failed after reconnect"));
      await settle();
    });
    expect(observed).toContain("active|88|true");

    // Old finally handlers cannot corrupt G2 accounting; fresh polling still proceeds.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await settle();
    });
    expect(battleResponses).toHaveLength(4);
    await resolveBattleRequest(
      3,
      battleSnapshot("server-g2", newStartedAt, "forge-1", "enc-g2", 2, 80),
    );
    expect(observed).toContain("active|80|true");
  });
});
