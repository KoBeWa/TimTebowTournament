// One number format for the whole site: German separators, narrow no-break space before %.
const NNBSP = " ";
const MINUS = "−";

export function fmtNum(v: number, digits = 1) {
  return v
    .toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace("-", MINUS);
}

// Integers (counts, ranks): thousands separator, no decimals.
export const fmtInt = (v: number) => fmtNum(v, 0);

// 0.604 -> "60,4 %"
export function fmtPct(fraction: number, digits = 1) {
  return `${fmtNum(fraction * 100, digits)}${NNBSP}%`;
}

// 60.4 (already a percentage) -> "60,4 %"
export function fmtPctPoints(v: number, digits = 1) {
  return `${fmtNum(v, digits)}${NNBSP}%`;
}

// 1.6 -> "+1,6", -0.6 -> "−0,6" (real minus sign)
export function fmtSigned(v: number, digits = 1) {
  const s = fmtNum(Math.abs(v), digits);
  const zero = Number(v.toFixed(digits)) === 0; // rounds to 0: no sign
  if (zero) return s;
  return v > 0 ? `+${s}` : `${MINUS}${s}`;
}

export function fmtSignedPctPoints(v: number, digits = 1) {
  return `${fmtSigned(v, digits)}${NNBSP}%`;
}
