#!/usr/bin/env node
import { execSync } from "node:child_process";

const run = (command) => {
  console.log(`→ ${command}`);
  execSync(command, { stdio: "inherit" });
};

run("npm run build");
run("node scripts/generate-widget-bundle.mjs");
console.log("Deploy script finished. Hook this into CI to trigger Vercel deploy + Cloudflare purge.");
