import { fmtSigned } from "@/lib/format";
// Formatting helpers shared by the draft components
export function sign(n: number) {
  return fmtSigned(n, 2);
}
