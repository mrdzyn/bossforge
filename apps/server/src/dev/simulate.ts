import { randomUUID } from "node:crypto";
import { ForgeStateSchema, type VoteCategory } from "@bossforge/shared";

const baseUrl = process.env.BOSSFORGE_URL ?? "http://127.0.0.1:3001";
const durationSeconds = Number(process.env.BOSSFORGE_VOTE_SECONDS ?? 5);
if (!Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 60) {
  throw new Error("BOSSFORGE_VOTE_SECONDS must be an integer from 5 to 60");
}

async function request(path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}
async function state() {
  const response = await request("/forge/state");
  if (!response.ok)
    throw new Error(
      `Forge snapshot failed with HTTP ${response.status}. Start local development first.`,
    );
  return ForgeStateSchema.parse(await response.json());
}

let current = await state();
if (current.status !== "idle") {
  const reset = await request("/dev/forge/reset", {});
  if (!reset.ok) throw new Error(`Could not reset previous cycle: HTTP ${reset.status}`);
}
const started = await request("/dev/forge/start", { durationSeconds });
if (!started.ok) throw new Error(`Could not start forge cycle: HTTP ${started.status}`);
process.stdout.write(`Started ${durationSeconds}s four-category local voting cycle.\n`);

const picks: Record<VoteCategory, string> = {
  body: "drake",
  element: "storm",
  special: "thunder-dash",
  weakness: "light",
};
const submitted = new Set<string>();
while (current.status !== "revealed") {
  current = await state();
  const category = current.activeCategory;
  if (current.status === "voting" && category && !submitted.has(category)) {
    for (const [viewerId, displayName] of [
      ["sim-ember", "Ember"],
      ["sim-rune", "Rune"],
    ] as const) {
      const result = await request("/dev/simulation/events", {
        kind: "chat.message",
        provider: "mock",
        message: {
          id: `sim-${randomUUID()}`,
          viewer: { id: viewerId, displayName },
          text: `!vote ${category} ${picks[category]}`,
          occurredAt: new Date().toISOString(),
        },
      });
      if (!result.ok) throw new Error(`Synthetic vote rejected with HTTP ${result.status}`);
    }
    submitted.add(category);
    process.stdout.write(`${category}: 2 synthetic votes submitted\n`);
  }
  if (current.status !== "revealed") await new Promise((resolve) => setTimeout(resolve, 180));
}
process.stdout.write(`Forge complete: ${JSON.stringify(current.boss)}\n`);
