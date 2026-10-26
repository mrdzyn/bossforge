import { createBossForgeApp } from "./app.js";

const host = process.env.BOSSFORGE_HOST ?? "127.0.0.1";
const port = Number(process.env.BOSSFORGE_PORT ?? 3001);
const server = await createBossForgeApp();

try {
  await server.app.listen({ host, port });
  process.stdout.write(`BossForge server listening on http://${host}:${port}\n`);
} catch (error) {
  process.stderr.write(
    `Server startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit(0));
  });
}
