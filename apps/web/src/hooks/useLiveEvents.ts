import { useCallback, useEffect, useRef, useState } from "react";
import {
  DashboardEventEnvelopeSchema,
  OverlayEventEnvelopeSchema,
  ForgeStateReconciler,
  PublicForgeStateSchema,
  type DashboardActivity,
  type ForgeState,
} from "@bossforge/shared";
import { isTwitchVoteCancelled, sanitizedForgeStartError } from "../live-forge-ui.js";

export function useLiveEvents(recipient: "dashboard" | "overlay" = "dashboard") {
  const reconciler = useRef<ForgeStateReconciler | null>(null);
  if (!reconciler.current) reconciler.current = new ForgeStateReconciler();
  const [activity, setActivity] = useState<DashboardActivity>({
    accepted: 0,
    rejected: 0,
    reasons: { invalid: 0, duplicate: 0, inactive: 0, other: 0 },
  });
  const [forge, setForge] = useState<ForgeState | null>(null);
  const forgeRef = useRef<ForgeState | null>(null);
  const [snapshotAvailable, setSnapshotAvailable] = useState(false);
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
      if (transportReadyGeneration.current === generation) setSnapshotAvailable(true);
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
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const snapshotPoll = setInterval(() => {
      if (active) void refresh(reconciler.current!.connectionGeneration);
    }, 2000);
    let socket: WebSocket | undefined;
    const connect = () => {
      if (!active) return;
      const generation = reconciler.current!.beginConnection();
      transportReadyGeneration.current = null;
      setSnapshotAvailable(false);
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/events/${recipient}`,
      );
      socket.addEventListener("open", () => {
        if (active) {
          transportReadyGeneration.current = generation;
          setConnection("connected");
          void refresh(generation);
        }
      });
      socket.addEventListener("close", () => {
        if (active && reconciler.current?.connectionGeneration === generation) {
          transportReadyGeneration.current = null;
          setSnapshotAvailable(false);
          setConnection("disconnected");
          retry = setTimeout(connect, 1200);
        }
      });
      socket.addEventListener("error", () => {
        if (active && reconciler.current?.connectionGeneration === generation) {
          transportReadyGeneration.current = null;
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
          if (recipient === "dashboard" && envelope.type === "dashboard.activity")
            setActivity(envelope.payload);
          if (
            transportReadyGeneration.current === generation &&
            envelope.type === "forge.state" &&
            envelope.payload.kind === "forge.state"
          )
            applyForge(envelope.payload.state, generation);
        } catch {
          setError("An invalid event was rejected by the browser.");
        }
      });
    };
    connect();
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      clearInterval(snapshotPoll);
      socket?.close();
    };
  }, [applyForge, recipient, refresh]);
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
  return { activity, forge, connection, error, notice, post, snapshotAvailable };
}
