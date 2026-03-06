/**
 * Synchronise la version depuis package.json vers tauri.conf.json et Cargo.toml.
 * Appelé automatiquement par le hook `postversion` de npm.
 * Usage : npm version 0.12.0   (ou patch / minor / major)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;

// tauri.conf.json
const tauriPath = resolve(root, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2) + "\n");

// Cargo.toml  (première occurrence de version = "…" dans [package])
const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const updatedCargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"/m,
  `version = "${version}"`
);
writeFileSync(cargoPath, updatedCargo);

console.log(`✓ Version ${version} synchronisée dans tauri.conf.json et Cargo.toml`);
