import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const backendPort = env.VITE_BACKEND_PORT || "5001";
  const frontendPort = env.VITE_FRONTEND_PORT || "5173";
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "https://ismigar.github.io/notion-digital-brain/",
    server: {
      port: Number(frontendPort),
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
