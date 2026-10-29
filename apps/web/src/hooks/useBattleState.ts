import { useCallback, useEffect, useRef, useState } from "react";
import {
  DashboardEventEnvelopeSchema,
  BattleStateReconciler,
  CommunityBattleStateV1Schema,
  type DashboardBattleActivity,
  type CommunityBattleStateV1,
} from "@bossforge/shared";
import { sendBattleMutation } from "./battle-mutation.js";

export function useBattleState() {
  const reconciler = useRef(new BattleStateReconciler());
  const [state, setState] = useState<CommunityBattleStateV1 | null>(null);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<DashboardBattleActivity | null>(null);
  const pendingRequests = useRef(new Map<string, string>());
  const refresh = useCallback(async (generation: number) => {
    try {
      const response = await fetch("/api/battle/state", { cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const next = CommunityBattleStateV1Schema.parse(await response.json());
      if (reconciler.current.connectionGeneration !== generation) return;
      if (reconciler.current.apply(next, generation, "snapshot")) {
        setState(reconciler.current.state);
        setFresh(true);
        setError("");
      }
    } catch {
      if (reconciler.current.connectionGeneration === generation) {
        reconciler.current.invalidate();
        setFresh(false);
        setState(null);
      }
    }
  }, []);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    const connect = () => {
      if (!active) return;
      const generation = reconciler.current.beginConnection();
      setFresh(false);
      setState(null);
      setActivity(null);
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/events/dashboard`,
      );
      socket.addEventListener("open", () => {
        if (active && generation === reconciler.current.connectionGeneration)
          void refresh(generation);
      });
      socket.addEventListener("message", (event) => {
        if (!active || generation !== reconciler.current.connectionGeneration) return;
        try {
          const parsed = DashboardEventEnvelopeSchema.safeParse(JSON.parse(String(event.data)));
          if (!parsed.success) throw new Error("invalid event");
          if (
            parsed.data.type === "battle.state" &&
            reconciler.current.apply(parsed.data.payload.state, generation, "websocket")
          ) {
            setState(reconciler.current.state);
            setFresh(reconciler.current.hasFreshState);
          } else if (parsed.data.type === "battle.activity") {
            const current = reconciler.current.state;
            if (
              current?.serverInstanceId === parsed.data.payload.serverInstanceId &&
              current.encounterId === parsed.data.payload.encounterId
            )
              setActivity(parsed.data.payload);
          }
        } catch {
          setError("Invalid battle state event was rejected.");
        }
      });
      socket.addEventListener("close", () => {
        if (active && generation === reconciler.current.connectionGeneration) {
          reconciler.current.invalidate();
          setFresh(false);
          setState(null);
          setActivity(null);
          retry = setTimeout(connect, 1200);
        }
      });
      socket.addEventListener("error", () => {
        if (active && generation === reconciler.current.connectionGeneration) {
          reconciler.current.invalidate();
          setFresh(false);
          setState(null);
          setActivity(null);
        }
      });
    };
    connect();
    const poll = setInterval(() => {
      if (active && socket?.readyState === WebSocket.OPEN)
        void refresh(reconciler.current.connectionGeneration);
    }, 2000);
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      clearInterval(poll);
      socket?.close();
    };
  }, [refresh]);
  const mutate = useCallback(
    async (kind: "start" | "cancel", payload: Record<string, unknown>) => {
      setError("");
      const context = reconciler.current.captureMutationContext(kind);
      if (!context) {
        setError("state_unavailable");
        return false;
      }
      const signature = JSON.stringify({ kind, ...payload, requestId: undefined });
      const requestId = pendingRequests.current.get(signature) ?? String(payload.requestId ?? "");
      pendingRequests.current.set(signature, requestId);
      const result = await sendBattleMutation(
        fetch,
        reconciler.current,
        context,
        `/api/dev/battle/${kind}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, requestId }),
        },
      );
      if (result.kind === "accepted") {
        pendingRequests.current.delete(signature);
        setState(reconciler.current.state);
        setFresh(true);
        return true;
      }
      if (result.kind === "stale") {
        void refresh(reconciler.current.connectionGeneration);
        return false;
      }
      if (result.kind === "http-error") {
        setError(result.code);
        if (result.status >= 400 && result.status < 500) pendingRequests.current.delete(signature);
        void refresh(context.generation);
        return false;
      }
      setError(result.kind === "conflict" ? "revision_conflict" : "state_unavailable");
      void refresh(reconciler.current.connectionGeneration);
      return false;
    },
    [refresh],
  );
  return { state: fresh ? state : null, fresh, error, activity, mutate };
}
