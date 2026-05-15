import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const monoRoot = path.resolve(__dirname, "..");
  const serverPkg = path.join(monoRoot, "server");
  const rootEnv = loadEnv(mode, monoRoot, "");
  const serverEnv = loadEnv(mode, serverPkg, "");
  const portRaw = Number.parseInt(String(serverEnv.PORT || rootEnv.PORT || "4000"), 10);
  const apiPort = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : 4000;
  /** Loopback IPv4 — matches typical Windows Node bind; must match `PORT` in root or server/.env */
  const API_ORIGIN = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      /** Listen on IPv4/LAN-friendly interface; avoids some Windows “localhost refused” quirks. */
      host: true,
      port: 5173,
      strictPort: false,
      proxy: {
        "/socket.io": {
          target: API_ORIGIN,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/api": {
          target: API_ORIGIN,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    /** Same proxy as dev — without this, `vite preview` + `/api` calls fail with “network error”. */
    preview: {
      host: true,
      port: 4173,
      strictPort: false,
      proxy: {
        "/socket.io": {
          target: API_ORIGIN,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/api": {
          target: API_ORIGIN,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
