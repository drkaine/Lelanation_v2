#!/usr/bin/env node
/**
 * Prépare une release companion : aligne les versions + commit optionnel + tag companion-v*.
 *
 * Usage :
 *   node scripts/companion-tag.mjs 1.0.0
 *   node scripts/companion-tag.mjs companion-v1.0.0 -m "Companion installer 1.0.0"
 *   node scripts/companion-tag.mjs 1.0.0 --no-push
 *   npm run release:tag -- 1.0.0 -m "Companion installer 1.0.0"
 *
 * Depuis la racine du monorepo :
 *   make companion-tag VERSION=1.0.0 MSG="Companion installer 1.0.0"
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const companionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(companionRoot, "..");

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd ?? repoRoot, ...opts });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", cwd: opts.cwd ?? repoRoot, ...opts }).trim();
}

function parseArgs(argv) {
  let version = "";
  let message = "";
  let commit = true;
  let push = true;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-commit") {
      commit = false;
      continue;
    }
    if (arg === "--no-push") {
      push = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "-m" || arg === "--message") {
      message = argv[++i] ?? "";
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!version) version = arg;
  }

  if (!version) {
    throw new Error(
      "Usage: companion-tag.mjs <version> [-m message] [--no-commit] [--no-push] [--dry-run]\n" +
        "  version: 1.0.0 or companion-v1.0.0"
    );
  }

  return { version, message, commit, push, dryRun };
}

const { version: versionArg, message, commit, push, dryRun } = parseArgs(process.argv.slice(2));

// Resolve target version without writing (reuse sync-version parser via subprocess in check mode)
const resolved = runCapture(
  `node -e "const v=process.argv[1]; const m=String(v).match(/^(?:companion-)?v?(\\d+\\.\\d+\\.\\d+)$/i); if(!m) throw new Error('bad version'); console.log(m[1]);" ${JSON.stringify(versionArg)}`,
  { cwd: companionRoot }
);
const tag = `companion-v${resolved}`;
const tagMessage = message || `Companion installer ${resolved}`;

const versionFiles = [
  "companion-app/package.json",
  "companion-app/src-tauri/tauri.conf.json",
  "companion-app/src-tauri/Cargo.toml",
];

console.log(`\nRelease companion ${resolved} → tag ${tag}`);

if (dryRun) {
  console.log("Dry-run: would sync version files, then:");
  if (commit) console.log(`  git commit -m "release: companion ${resolved}"`);
  console.log(`  git tag -a ${tag} -m "${tagMessage}"`);
  if (push) console.log(`  git push origin HEAD ${tag}`);
  process.exit(0);
}

run(`node scripts/sync-version.mjs ${JSON.stringify(versionArg)}`, { cwd: companionRoot });

const existing = runCapture(`git tag -l ${JSON.stringify(tag)}`, { cwd: repoRoot });
if (existing) {
  throw new Error(`Tag ${tag} already exists locally. Delete it first or pick another version.`);
}

if (commit) {
  run(`git add ${versionFiles.map((f) => JSON.stringify(f)).join(" ")}`);
  const status = runCapture("git status --porcelain");
  if (status) {
    run(`git commit -m ${JSON.stringify(`release: companion ${resolved}`)}`);
  } else {
    console.log("No version file changes to commit (already at target version).");
  }
}

run(`git tag -a ${JSON.stringify(tag)} -m ${JSON.stringify(tagMessage)}`);

console.log(`\n✓ Tag ${tag} created.`);

if (push) {
  console.log(`Pushing branch and tag to origin…`);
  run(`git push origin HEAD ${JSON.stringify(tag)}`);
  console.log(`✓ Pushed HEAD and ${tag} — GitHub Actions should start on tag push.`);
} else {
  console.log(`  Skipped push (--no-push). Run: git push origin HEAD ${tag}`);
}
