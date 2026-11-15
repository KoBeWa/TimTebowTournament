// Formatting helpers shared by the draft components
export function sign(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}
