/**
 * Réglages numériques stockés dans un fichier JSON, modifiables depuis Gestion.
 * Lu par le backend ET le poller : `get()` relit le fichier quand il change (mtime, vérifié au plus
 * toutes les `recheckMs`). Fichier absent ou invalide → défauts.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export interface LimitSpec<T> {
  key: keyof T;
  min: number;
  max?: number;
  integer?: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function validValue<T>(spec: LimitSpec<T>, v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  if (spec.integer && !Number.isInteger(v)) return false;
  return v >= spec.min && (spec.max === undefined || v <= spec.max);
}

function isComplete<K extends string>(
  out: Partial<Record<K, number>>,
  specs: ReadonlyArray<LimitSpec<Record<K, number>>>,
): out is Record<K, number> {
  return specs.every((s) => typeof out[s.key] === 'number');
}

export function parseLimits<K extends string>(
  specs: ReadonlyArray<LimitSpec<Record<K, number>>>,
  raw: unknown,
  check?: (l: Record<K, number>) => boolean,
): Record<K, number> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<K, number>> = {};
  for (const spec of specs) {
    const v = raw[spec.key];
    if (!validValue(spec, v)) return null;
    out[spec.key] = v;
  }
  if (!isComplete(out, specs)) return null;
  return !check || check(out) ? out : null;
}

export interface LimitsStore<T> {
  get(): T;
  update(body: unknown): { ok: true; settings: T } | { ok: false };
  reset(): void;
}

export function createLimitsStore<K extends string>(opts: {
  file: () => string;
  specs: ReadonlyArray<LimitSpec<Record<K, number>>>;
  defaults: () => Record<K, number>;
  check?: (l: Record<K, number>) => boolean;
  recheckMs?: number;
}): LimitsStore<Record<K, number>> {
  type T = Record<K, number>;
  const recheckMs = opts.recheckMs ?? 5_000;
  let cached: { value: T; mtimeMs: number; file: string } | null = null;
  let checkedAt = 0;

  function readFile(file: string): { value: T; mtimeMs: number } | null {
    try {
      const mtimeMs = statSync(file).mtimeMs;
      const value = parseLimits(opts.specs, JSON.parse(readFileSync(file, 'utf8')), opts.check);
      return value ? { value, mtimeMs } : null;
    } catch {
      return null;
    }
  }

  function get(): T {
    const file = opts.file();
    const now = Date.now();
    if (cached && cached.file === file && now - checkedAt < recheckMs) return cached.value;
    checkedAt = now;
    let mtimeMs: number | null = null;
    try {
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      mtimeMs = null;
    }
    if (mtimeMs === null) {
      cached = null;
      return opts.defaults();
    }
    if (cached && cached.file === file && cached.mtimeMs === mtimeMs) return cached.value;
    const read = readFile(file);
    if (!read) {
      cached = null;
      return opts.defaults();
    }
    cached = { ...read, file };
    return read.value;
  }

  function update(body: unknown): { ok: true; settings: T } | { ok: false } {
    const settings = parseLimits(opts.specs, body, opts.check);
    if (!settings) return { ok: false };
    const file = opts.file();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(settings, null, 2));
    cached = { value: settings, mtimeMs: statSync(file).mtimeMs, file };
    checkedAt = Date.now();
    return { ok: true, settings };
  }

  return {
    get,
    update,
    reset: () => {
      cached = null;
      checkedAt = 0;
    },
  };
}
