import { useCallback, useEffect, useRef, useState } from "react";
import {
  DashboardEventEnvelopeSchema,
  OverlayEventEnvelopeSchema,
  BattleStateReconciler,
  OverlayBattleStateV1Schema,
  ForgeStateReconciler,
  PublicForgeStateSchema,
  type OverlayBattleStateV1,
  type ForgeState,
} from "@bossforge/shared";
import { isTwitchVoteCancelled, sanitizedForgeStartError } from "../live-forge-ui.js";
import { DashboardActivityReconciler } from "../dashboard-activity-reconciler.js";

const MAX_OVERLAY_SNAPSHOT_REQUESTS = 2;

function advanceOverlaySnapshotFence(
  sequence: { current: number },
  owner: { current: symbol },
): { sequence: number; owner: symbol } {
  sequence.current = sequence.current >= Number.MAX_SAFE_INTEGER ? 0 : sequence.current + 1;
  owner.current = Symbol("overlay-snapshot");
  return { sequence: sequence.current, owner: owner.current };
}

export function useLiveEvents(recipient: "dashboard" | "overlay" = "dashboard") {
  const reconciler = useRef<ForgeStateReconciler | null>(null);
  if (!reconciler.current) reconciler.current = new ForgeStateReconciler();
  const overlayBattleReconciler = useRef<BattleStateReconciler<OverlayBattleStateV1> | null>(null);
  if (!overlayBattleReconciler.current)
    overlayBattleReconciler.current = new BattleStateReconciler<OverlayBattleStateV1>();
  const activityReconciler = useRef<DashboardActivityReconciler | null>(null);
  if (!activityReconciler.current) activityReconciler.current = new DashboardActivityReconciler();
  const [, setActivityRevision] = useState(0);
  const [forge, setForge] = useState<ForgeState | null>(null);
  const forgeRef = useRef<ForgeState | null>(null);
  const [snapshotAvailable, setSnapshotAvailable] = useState(false);
  const [overlayBattle, setOverlayBattle] = useState<OverlayBattleStateV1 | null>(null);
  const [overlayBattleFresh, setOverlayBattleFresh] = useState(false);
  const overlaySnapshotSequence = useRef(0);
  const overlaySnapshotOwner = useRef(Symbol("overlay-snapshot"));
  const overlaySnapshotRequests = useRef(0);
  const appliedVersion = useRef(0);
  const [connection, setConnection] = useState("connecting");
  const transportReadyGeneration = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const applyForge = useCallback((next: ForgeState, generation: number) => {
    if (reconciler.current?.apply(next, generation)) {
      const previous = forgeRef.current;
      if (isTwitchVoteCancelled(previous, next))
        setNotice(
          "Voting was canceled because the Twitch connection was lost. Reconnect to start a new forge.",
        );
      else if (next.status === "voting" || next.status === "revealed") setNotice("");
      forgeRef.current = next;
      setForge(next);
      if (transportReadyGeneration.current === generation) {
        activityReconciler.current?.applyForgeState(next, generation);
        setActivityRevision((revision) => revision + 1);
        setSnapshotAvailable(true);
      }
      appliedVersion.current += 1;
    }
  }, []);
  const refresh = useCallback(
    async (generation: number) => {
      if (transportReadyGeneration.current !== generation) return;
      const versionAtStart = appliedVersion.current;
      try {
        const response = await fetch("/api/forge/state");
        if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
        const next = PublicForgeStateSchema.parse(await response.json());
        if (
          transportReadyGeneration.current !== generation ||
          reconciler.current?.connectionGeneration !== generation
        )
          return;
        applyForge(next, generation);
        const current = reconciler.current?.state;
        if (
          reconciler.current?.connectionGeneration === generation &&
          current?.serverInstanceId === next.serverInstanceId &&
          current.revision === next.revision
        )
          setSnapshotAvailable(true);
      } catch {
        // Never let a client keep fighting a revealed boss after its authority is unavailable.
        if (
          transportReadyGeneration.current === generation &&
          reconciler.current?.connectionGeneration === generation &&
          appliedVersion.current === versionAtStart
        )
          setSnapshotAvailable(false);
      }
    },
    [applyForge],
  );
  const refreshOverlayBattle = useCallback(
    async (generation: number) => {
      if (recipient !== "overlay" || transportReadyGeneration.current !== generation) return;
      if (overlaySnapshotRequests.current >= MAX_OVERLAY_SNAPSHOT_REQUESTS) return;
      overlaySnapshotRequests.current += 1;
      const requestFence = advanceOverlaySnapshotFence(
        overlaySnapshotSequence,
        overlaySnapshotOwner,
      );
      try {
        const response = await fetch("/api/battle/overlay-state", { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const parsed = OverlayBattleStateV1Schema.safeParse(await response.json());
        if (!parsed.success) throw new Error("invalid");
        if (
          requestFence.sequence !== overlaySnapshotSequence.current ||
          requestFence.owner !== overlaySnapshotOwner.current ||
          transportReadyGeneration.current !== generation ||
          reconciler.current?.connectionGeneration !== generation ||
          overlayBattleReconciler.current?.connectionGeneration !== generation
        )
          return;
        if (overlayBattleReconciler.current?.apply(parsed.data, generation, "snapshot")) {
          setOverlayBattle(overlayBattleReconciler.current.state);
          setOverlayBattleFresh(overlayBattleReconciler.current.hasFreshState);
        }
      } catch {
        if (
          requestFence.sequence === overlaySnapshotSequence.current &&
          requestFence.owner === overlaySnapshotOwner.current &&
          transportReadyGeneration.current === generation &&
          overlayBattleReconciler.current?.connectionGeneration === generation
        ) {
          advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
          overlayBattleReconciler.current.invalidate();
          setOverlayBattle(null);
          setOverlayBattleFresh(false);
        }
      } finally {
        overlaySnapshotRequests.current -= 1;
      }
    },
    [recipient],
  );
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const snapshotPoll = setInterval(() => {
      if (active) {
        const generation = reconciler.current!.connectionGeneration;
        void refresh(generation);
        void refreshOverlayBattle(generation);
      }
    }, 2000);
    let socket: WebSocket | undefined;
    const connect = () => {
      if (!active) return;
      const generation = reconciler.current!.beginConnection();
      advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
      const battleGeneration = overlayBattleReconciler.current!.beginConnection();
      if (battleGeneration !== generation) throw new Error("Battle state generations diverged");
      const activityGeneration = activityReconciler.current!.beginConnection();
      if (activityGeneration !== generation) throw new Error("Live state generations diverged");
      transportReadyGeneration.current = null;
      setActivityRevision((revision) => revision + 1);
      setSnapshotAvailable(false);
      setOverlayBattle(null);
      setOverlayBattleFresh(false);
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/events/${recipient}`,
      );
      socket.addEventListener("open", () => {
        if (active) {
          transportReadyGeneration.current = generation;
          activityReconciler.current?.setTransportReady(generation, true);
          setActivityRevision((revision) => revision + 1);
          setConnection("connected");
          void refresh(generation);
          void refreshOverlayBattle(generation);
        }
      });
      socket.addEventListener("close", () => {
        if (active && reconciler.current?.connectionGeneration === generation) {
          advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
          transportReadyGeneration.current = null;
          overlayBattleReconciler.current?.invalidate();
          setOverlayBattle(null);
          setOverlayBattleFresh(false);
          activityReconciler.current?.setTransportReady(generation, false);
          setActivityRevision((revision) => revision + 1);
          setSnapshotAvailable(false);
          setConnection("disconnected");
          retry = setTimeout(connect, 1200);
        }
      });
      socket.addEventListener("error", () => {
        if (active && reconciler.current?.connectionGeneration === generation) {
          advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
          transportReadyGeneration.current = null;
          overlayBattleReconciler.current?.invalidate();
          setOverlayBattle(null);
          setOverlayBattleFresh(false);
          activityReconciler.current?.setTransportReady(generation, false);
          setActivityRevision((revision) => revision + 1);
          setSnapshotAvailable(false);
          setConnection("error");
        }
      });
      socket.addEventListener("message", (message) => {
        if (!active || reconciler.current?.connectionGeneration !== generation) return;
        try {
          const raw: unknown = JSON.parse(String(message.data));
          const parsed =
            recipient === "dashboard"
              ? DashboardEventEnvelopeSchema.safeParse(raw)
              : OverlayEventEnvelopeSchema.safeParse(raw);
          if (!parsed.success) throw new Error("invalid public event");
          const envelope = parsed.data;
          if (recipient === "dashboard" && envelope.type === "dashboard.activity") {
            if (activityReconciler.current?.applyActivity(envelope.payload, generation))
              setActivityRevision((revision) => revision + 1);
          }
          if (
            transportReadyGeneration.current === generation &&
            envelope.type === "forge.state" &&
            envelope.payload.kind === "forge.state"
          )
            applyForge(envelope.payload.state, generation);
          if (
            recipient === "overlay" &&
            transportReadyGeneration.current === generation &&
            envelope.type === "battle.state" &&
            overlayBattleReconciler.current?.apply(envelope.payload.state, generation, "websocket")
          ) {
            // A newer validated socket event supersedes every HTTP snapshot already in flight.
            advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
            setOverlayBattle(overlayBattleReconciler.current.state);
            setOverlayBattleFresh(overlayBattleReconciler.current.hasFreshState);
          }
        } catch {
          setError("An invalid event was rejected by the browser.");
        }
      });
    };
    connect();
    return () => {
      active = false;
      advanceOverlaySnapshotFence(overlaySnapshotSequence, overlaySnapshotOwner);
      transportReadyGeneration.current = null;
      if (retry) clearTimeout(retry);
      clearInterval(snapshotPoll);
      socket?.close();
    };
  }, [applyForge, recipient, refresh, refreshOverlayBattle]);
  const post = useCallback(
    async (path: string, body?: unknown): Promise<boolean> => {
      const generation = reconciler.current?.connectionGeneration ?? 0;
      setError("");
      try {
        const response = await fetch(path, {
          method: "POST",
          ...(body
            ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
            : {}),
        });
        if (!response.ok) {
          let serverError: unknown;
          try {
            const payload: unknown = await response.json();
            if (payload && typeof payload === "object" && "error" in payload)
              serverError = payload.error;
          } catch {
            // Status-specific messages below remain sanitized if no JSON body exists.
          }
          setError(sanitizedForgeStartError(response.status, serverError));
          return false;
        }
        const result = PublicForgeStateSchema.safeParse(await response.json());
        if (result.success) applyForge(result.data, generation);
        else
          setError("The local server returned an invalid forge state. Reconnect the server link.");
        return result.success;
      } catch {
        setError("Local forge request failed. Confirm the development server is running.");
        return false;
      }
    },
    [applyForge],
  );
  const activity =
    activityReconciler.current?.getActivity(
      reconciler.current?.connectionGeneration ?? -1,
      connection === "connected",
      snapshotAvailable,
    ) ?? null;
  return {
    activity,
    forge,
    connection,
    error,
    notice,
    post,
    snapshotAvailable,
    overlayBattle: recipient === "overlay" && overlayBattleFresh ? overlayBattle : null,
    overlayBattleFresh,
  };
}
