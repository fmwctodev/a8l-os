#!/usr/bin/env node
/**
 * Deploy a Supabase edge function via the Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/deploy-function.mjs <function-name> [--no-verify-jwt]
 *
 * Reads the function from supabase/functions/<function-name>/index.ts and
 * includes any imports from ../_shared/*.ts automatically.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || "uscpncgnkmjirbrpidgu";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("ERROR: SUPABASE_ACCESS_TOKEN environment variable required");
  process.exit(1);
}

const functionName = process.argv[2];
if (!functionName) {
  console.error("Usage: node deploy-function.mjs <function-name> [--no-verify-jwt]");
  process.exit(1);
}

const verifyJwt = !process.argv.includes("--no-verify-jwt");

const fnDir = join(REPO_ROOT, "supabase", "functions", functionName);
const sharedDir = join(REPO_ROOT, "supabase", "functions", "_shared");

if (!existsSync(fnDir)) {
  console.error(`Function directory not found: ${fnDir}`);
  process.exit(1);
}

const files = [];

// Main index.ts
const indexPath = join(fnDir, "index.ts");
files.push({
  name: "index.ts",
  content: readFileSync(indexPath, "utf-8"),
});

// Include all shared files (simpler than parsing imports)
if (existsSync(sharedDir)) {
  for (const f of readdirSync(sharedDir)) {
    if (f.endsWith(".ts")) {
      files.push({
        name: `../_shared/${f}`,
        content: readFileSync(join(sharedDir, f), "utf-8"),
      });
    }
  }
}

console.log(`Deploying ${functionName} with ${files.length} files (verify_jwt=${verifyJwt})...`);

const url = `https://api.supabase.com/v1/projects/${PROJECT_ID}/functions/deploy?slug=${functionName}`;

const form = new FormData();
form.append(
  "metadata",
  JSON.stringify({
    name: functionName,
    entrypoint_path: "index.ts",
    verify_jwt: verifyJwt,
  }),
);

for (const f of files) {
  form.append("file", new Blob([f.content], { type: "application/typescript" }), f.name);
}

const resp = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}` },
  body: form,
});

const body = await resp.text();
if (!resp.ok) {
  console.error(`Deploy failed (${resp.status}): ${body}`);
  process.exit(1);
}

console.log("Deployed successfully:");
console.log(body);
