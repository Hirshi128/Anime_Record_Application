import { spawn } from "node:child_process";

const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check with npm run verify.");

// Override even configured production URLs for every verification subprocess.
const env = {
  ...process.env,
  AUTH_MODE: "credentials",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/anime_verification",
  DIRECT_URL: "postgresql://test:test@127.0.0.1:5432/anime_verification",
};

for (const script of ["test", "lint", "build", "test:browser:personal"]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, "run", script], { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
