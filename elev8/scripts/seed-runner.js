#!/usr/bin/env node
/**
 * Seed runner — wraps tsx with --dns-result-order=ipv4first
 * so it works on Windows where IPv6 causes ETIMEDOUT with Supabase.
 *
 * Uses plain Node.js + spawns tsx's actual JS entry point directly.
 * No cross-env, no shell tricks, no PATH issues.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// tsx's real JS entry point (not the .cmd shell wrapper)
// Works on Windows, Mac, Linux identically
const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const seedFile = path.join(ROOT, 'drizzle', 'seed', 'index.ts');

if (!fs.existsSync(tsxCli)) {
  console.error('tsx not found at:', tsxCli);
  console.error('Run: npm install');
  process.exit(1);
}

if (!fs.existsSync(seedFile)) {
  console.error('Seed file not found at:', seedFile);
  process.exit(1);
}

console.log('Running seed with IPv4 preference...\n');

const result = spawnSync(
  process.execPath,                        // same node.exe that is running this script
  [
    '--dns-result-order=ipv4first',        // force IPv4 — fixes ETIMEDOUT on Windows
    tsxCli,                                // tsx's actual .mjs entry (not a shell wrapper)
    seedFile,
  ],
  {
    stdio: 'inherit',
    shell: false,                          // no shell = no .cmd/.sh issues
    env: process.env,
    cwd: ROOT,
  }
);

process.exit(result.status ?? 1);
