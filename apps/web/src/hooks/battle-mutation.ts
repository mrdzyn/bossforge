import {
  CommunityBattleStateV1Schema,
  type BattleMutationContext,
  type BattleStateReconciler,
} from "@bossforge/shared";

export type BattleMutationResult =
  | { kind: "accepted" }
  | { kind: "stale" }
  | { kind: "conflict" }
  | { kind: "unavailable" }
  | { kind: "http-error"; status: number; code: string };

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

/** Send a mutation and accept its result only under the authority captured at dispatch. */
export async function sendBattleMutation(
  fetcher: typeof fetch,
  reconciler: BattleStateReconciler,
  context: BattleMutationContext,
  url: string,
  request: RequestInit,
): Promise<BattleMutationResult> {
  try {
    const response = await fetcher(url, request);
    const body: unknown = await response.json().catch(() => null);
    if (!reconciler.isMutationContextCurrent(context)) return { kind: "stale" };
    if (!response.ok) {
      const candidate =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "state_unavailable";
      return {
        kind: "http-error",
        status: response.status,
        code: safeErrors.has(candidate) ? candidate : "state_unavailable",
      };
    }
    const parsed = CommunityBattleStateV1Schema.safeParse(body);
    if (!parsed.success) return { kind: "unavailable" };
    if (
      !reconciler.isMutationResponseForContext(context, parsed.data) ||
      !reconciler.apply(parsed.data, context.generation, "mutation")
    )
      return { kind: "conflict" };
    return { kind: "accepted" };
  } catch {
    return reconciler.isMutationContextCurrent(context)
      ? { kind: "unavailable" }
      : { kind: "stale" };
  }
}
