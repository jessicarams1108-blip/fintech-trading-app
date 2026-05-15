/**
 * Wait until the API accepts TCP on PORT (same resolution as server: root .env then server/.env),
 * then start Vite. Avoids ECONNREFUSED spam when `concurrently` starts web before the server is listening.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const { default: dotenv } = await import("dotenv");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "server", ".env"), override: true });

const portRaw = Number.parseInt(String(process.env.PORT || "4000"), 10);
const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : 4000;

const waitOn = (await import("wait-on")).default;
try {
  await waitOn({
    resources: [`tcp:127.0.0.1:${port}`],
    timeout: 120_000,
    interval: 200,
    window: 1_000,
  });
} catch (e) {
  console.error(
    `[wait-and-dev-web] API did not open on 127.0.0.1:${port} within 120s. Check DATABASE_URL / JWT_SECRET and that PORT matches web/vite proxy.\n`,
    e instanceof Error ? e.message : e,
  );
  process.exit(1);
}

const child = spawn("npm", ["run", "dev", "-w", "web"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
