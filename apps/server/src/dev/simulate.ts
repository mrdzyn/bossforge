const baseUrl = process.env.BOSSFORGE_URL ?? "http://127.0.0.1:3001";

for (let index = 0; index < 4; index += 1) {
  const response = await fetch(`${baseUrl}/dev/simulation/next`, { method: "POST" });
  if (response.status === 204) {
    process.stdout.write("Mock sequence is complete. Restart the server to replay it.\n");
    break;
  }
  if (!response.ok) {
    throw new Error(
      `Simulation request failed with HTTP ${response.status}. Is local dev running?`,
    );
  }
  const result: unknown = await response.json();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 180));
}
