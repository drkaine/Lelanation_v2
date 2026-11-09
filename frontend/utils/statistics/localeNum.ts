/** Locale-aware number display for statistics tables (fr: "42,5", en: "42.5"). */
export function fmtLocNum(v: number | null | undefined, digits: number, locale: string): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Signed delta: "+1,93", "−1,66", "=" when ≈ 0, "" when missing. */
export function fmtLocSigned(v: number | null | undefined, digits: number, locale: string): string {
  if (v == null || !Number.isFinite(Number(v))) return ''
  const half = 0.5 * 10 ** -digits
  if (Math.abs(v) < half) return '='
  const body = fmtLocNum(Math.abs(v), digits, locale)
  return v > 0 ? `+${body}` : `−${body}`
}

/** CSS tone for a delta; `invert` when lower is better. */
export function deltaToneClass(v: number | null | undefined, invert = false): string {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.005) return ''
  return v > 0 !== invert ? 'is-up' : 'is-down'
}
