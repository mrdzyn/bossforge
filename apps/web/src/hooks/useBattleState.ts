import { useCallback, useEffect, useRef, useState } from "react";
import {
  BattleEventEnvelopeSchema,
  BattleStateReconciler,
  CommunityBattleStateV1Schema,
  type CommunityBattleStateV1,
} from "@bossforge/shared";

export function useBattleState() {
  const reconciler = useRef(new BattleStateReconciler());
  const [state, setState] = useState<CommunityBattleStateV1 | null>(null);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
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
          const parsed = BattleEventEnvelopeSchema.safeParse(JSON.parse(String(event.data)));
          if (
            parsed.success &&
            reconciler.current.apply(parsed.data.payload.state, generation, "websocket")
          ) {
            setState(reconciler.current.state);
            setFresh(reconciler.current.hasFreshState);
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
          retry = setTimeout(connect, 1200);
        }
      });
      socket.addEventListener("error", () => {
        if (active && generation === reconciler.current.connectionGeneration) {
          reconciler.current.invalidate();
          setFresh(false);
          setState(null);
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
      const signature = JSON.stringify({ kind, ...payload, requestId: undefined });
      const requestId = pendingRequests.current.get(signature) ?? String(payload.requestId ?? "");
      pendingRequests.current.set(signature, requestId);
      try {
        const response = await fetch(`/api/dev/battle/${kind}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, requestId }),
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const candidate =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "state_unavailable";
          const safeErrors = new Set([
            "invalid_request",
            "owner_auth_required",
            "origin_rejected",
            "local_access_denied",
            "mode_disabled",
            "battle_not_ready",
            "revision_conflict",
            "encounter_active",
            "provider_unverified",
            "idempotency_conflict",
            "rate_limited",
            "state_unavailable",
          ]);
          const code = safeErrors.has(candidate) ? candidate : "state_unavailable";
          setError(code);
          if (response.status >= 400 && response.status < 500)
            pendingRequests.current.delete(signature);
          void refresh(reconciler.current.connectionGeneration);
          return false;
        }
        pendingRequests.current.delete(signature);
        const next = CommunityBattleStateV1Schema.parse(body);
        const generation = reconciler.current.connectionGeneration;
        if (reconciler.current.apply(next, generation, "mutation")) {
          setState(reconciler.current.state);
          setFresh(true);
          return true;
        }
        setError("revision_conflict");
        return false;
      } catch {
        setError("state_unavailable");
        return false;
      }
    },
    [refresh],
  );
  return { state: fresh ? state : null, fresh, error, mutate };
}
