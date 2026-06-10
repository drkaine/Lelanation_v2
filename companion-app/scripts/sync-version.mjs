/**
 * Synchronise la version companion vers package.json, tauri.conf.json et Cargo.toml.
 *
 * Usage :
 *   node scripts/sync-version.mjs              # lit package.json
 *   node scripts/sync-version.mjs 1.0.0        # fixe la version puis synchronise
 *   npm version patch                          # postversion appelle ce script sans arg
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const semverRe = /^\d+\.\d+\.\d+$/;

function parseVersionArg(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const fromTag = trimmed.match(/^(?:companion-)?v?(\d+\.\d+\.\d+)$/i);
  if (fromTag) return fromTag[1];
  if (semverRe.test(trimmed)) return trimmed;
  throw new Error(`Invalid version "${raw}" (expected 1.2.3 or companion-v1.2.3)`);
}

const cliVersion = parseVersionArg(process.argv[2]);

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = cliVersion ?? pkg.version;

if (!semverRe.test(version)) {
  throw new Error(`Invalid semver in package.json: "${version}"`);
}

if (cliVersion) {
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

const tauriPath = resolve(root, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2) + "\n");

const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const updatedCargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"/m,
  `version = "${version}"`
);
writeFileSync(cargoPath, updatedCargo);

console.log(`✓ Version ${version} synchronisée (package.json, tauri.conf.json, Cargo.toml)`);
