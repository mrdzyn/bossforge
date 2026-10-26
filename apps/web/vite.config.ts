import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST ?? "127.0.0.1",
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
