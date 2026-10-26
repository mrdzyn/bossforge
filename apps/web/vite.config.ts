import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getLoopbackViteHost } from "./src/dev-server-host.js";

export default defineConfig({
  plugins: [react()],
  server: {
    host: getLoopbackViteHost(),
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/health": `http://127.0.0.1:${process.env.BOSSFORGE_PORT ?? 3001}`,
      "/events": { target: `ws://127.0.0.1:${process.env.BOSSFORGE_PORT ?? 3001}`, ws: true },
      "/api": {
        target: `http://127.0.0.1:${process.env.BOSSFORGE_PORT ?? 3001}`,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
