#!/usr/bin/env node
/**
 * Elev8 Comply — Setup Script  (fully non-interactive)
 * Run: node scripts/setup.js
 */
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function ok(m)   { console.log('  ✓  ' + m); }
function fail(m) { console.error('  ✗  ' + m); }
function info(m) { console.log('  →  ' + m); }
function step(n,t){ console.log('\n── Step '+n+'/4: '+t+' '+'─'.repeat(Math.max(0,44-t.length))); }

function run(cmd, silent) {
  return spawnSync(cmd, {
    cwd: ROOT, shell: true,
    stdio: silent ? 'pipe' : 'inherit',
    env: { ...process.env, CI: '1' },
  });
}

function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function nuke(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return;
  try { fs.rmSync(full, { recursive: true, force: true }); info('Removed ' + rel); }
  catch { spawnSync(process.platform==='win32'?`cmd /c rmdir /s /q "${full}"`:`rm -rf "${full}"`,{shell:true,stdio:'pipe'}); }
}

console.log('\n╔══════════════════════════════════════════╗');
console.log('║       Elev8 Comply — Project Setup       ║');
console.log('╚══════════════════════════════════════════╝');

// Step 1 — env
step(1,'Environment file');
if (!exists('.env.local')) {
  fs.copyFileSync(path.join(ROOT,'.env.example'), path.join(ROOT,'.env.local'));
  ok('.env.local created — fill in your credentials');
} else { info('.env.local already exists — skipping'); }

// Step 2 — clean install
step(2,'Installing dependencies');
info('Clearing npm cache…');
run('npm cache clean --force', true);
nuke('node_modules');
try { fs.unlinkSync(path.join(ROOT,'package-lock.json')); info('Removed package-lock.json'); } catch {}
info('Running npm install — takes 1–3 minutes…');
const inst = run('npm install', false);
if (inst.status !== 0) { fail('npm install failed — try running it manually'); process.exit(1); }
ok('Dependencies installed');

// Step 3 — shadcn (fully non-interactive)
step(3,'Setting up shadcn/ui');

// Write components.json directly — skips ALL shadcn prompts
const cfg = {
  "$schema":"https://ui.shadcn.com/schema.json",
  "style":"default","rsc":true,"tsx":true,
  "tailwind":{
    "config":"tailwind.config.ts",
    "css":"src/app/globals.css",
    "baseColor":"slate",
    "cssVariables":true,
    "prefix":""
  },
  "aliases":{
    "components":"@/components","utils":"@/lib/utils",
    "ui":"@/components/ui","lib":"@/lib","hooks":"@/hooks"
  },
  "iconLibrary":"lucide"
};
fs.writeFileSync(path.join(ROOT,'components.json'), JSON.stringify(cfg,null,2)+'\n');
ok('components.json written');

// NOTE: toast is removed from new shadcn — we use sonner instead
const COMPONENTS = [
  'button','card','badge','dialog','form','input','label',
  'select','textarea','separator','avatar','tabs','checkbox',
  'popover','alert-dialog','scroll-area','switch','progress',
  'table','skeleton','dropdown-menu','sonner',
];

info('Adding shadcn/ui components (using sonner, not toast)…');
const batch = run(`npx --yes shadcn@latest add ${COMPONENTS.join(' ')} --yes --overwrite`, false);

if (batch.status !== 0) {
  info('Batch failed — retrying one at a time…');
  for (const c of COMPONENTS) {
    const r = run(`npx --yes shadcn@latest add ${c} --yes --overwrite`, true);
    console.log(r.status===0 ? `  ✓  ${c}` : `  -  ${c} (skipped)`);
  }
}
ok('shadcn/ui components done');

// Step 4 — verify
step(4,'Verifying');
const checks = [
  ['node_modules/next','Next.js'],
  ['node_modules/sonner','sonner (toast)'],
  ['node_modules/drizzle-orm','Drizzle ORM'],
  ['node_modules/@supabase/ssr','Supabase SSR'],
  ['components.json','components.json'],
  ['src/components/ui/button.tsx','shadcn button'],
  ['src/components/ui/card.tsx','shadcn card'],
  ['.env.local','.env.local'],
];
let good = true;
for (const [f,l] of checks) { if(exists(f)){ok(l);}else{fail(l+' — MISSING');good=false;} }

console.log('');
if (good) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  Setup Complete! 🎉                       ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  1. Fill in .env.local with your API keys                ║');
  console.log('║  2. Run Supabase SQL migrations (4 files in order)       ║');
  console.log('║  3. Create 3 Supabase Storage buckets                    ║');
  console.log('║  4. npm run dev  →  http://localhost:3000                ║');
  console.log('║  5. npm run db:seed  (optional test data)                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
} else {
  console.log('⚠  Setup done with warnings — run npm run dev and see what breaks.');
}
console.log('');
