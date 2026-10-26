import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppEventEnvelopeSchema,
  ForgeStateReconciler,
  ForgeStateSchema,
  type AppEventEnvelope,
  type ForgeState,
} from "@bossforge/shared";

export function useLiveEvents() {
  const reconciler = useRef<ForgeStateReconciler | null>(null);
  if (!reconciler.current) reconciler.current = new ForgeStateReconciler();
  const [events, setEvents] = useState<AppEventEnvelope[]>([]);
  const [forge, setForge] = useState<ForgeState | null>(null);
  const [snapshotAvailable, setSnapshotAvailable] = useState(false);
  const appliedVersion = useRef(0);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const applyForge = useCallback((next: ForgeState, generation: number) => {
    if (reconciler.current?.apply(next, generation)) {
      setForge(next);
      setSnapshotAvailable(true);
      appliedVersion.current += 1;
    }
  }, []);
  const refresh = useCallback(
    async (generation: number) => {
      const versionAtStart = appliedVersion.current;
      try {
        const response = await fetch("/api/forge/state");
        if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
        const next = ForgeStateSchema.parse(await response.json());
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
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/events`,
      );
      socket.addEventListener("open", () => {
        if (active) {
          setConnection("connected");
          void refresh(generation);
        }
      });
      socket.addEventListener("close", () => {
        if (active && reconciler.current?.connectionGeneration === generation) {
          setConnection("disconnected");
          retry = setTimeout(connect, 1200);
        }
      });
      socket.addEventListener("error", () => {
        if (active) setConnection("error");
      });
      socket.addEventListener("message", (message) => {
        try {
          const envelope = AppEventEnvelopeSchema.parse(JSON.parse(String(message.data)));
          setEvents((current) => [envelope, ...current].slice(0, 16));
          if (envelope.type === "forge.state" && envelope.payload.kind === "forge.state")
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
  }, [applyForge, refresh]);
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
        if (!response.ok) throw new Error(String(response.status));
        const result = ForgeStateSchema.safeParse(await response.json());
        if (result.success) applyForge(result.data, generation);
        return result.success;
      } catch {
        setError("Local forge request failed. Confirm the development server is running.");
        return false;
      }
    },
    [applyForge],
  );
  return { events, forge, connection, error, post, snapshotAvailable };
}
