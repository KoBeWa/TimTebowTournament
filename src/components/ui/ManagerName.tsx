import Link from "next/link";
import { MANAGER_COLORS } from "@/lib/constants";

// Manager name with their colour mark; links to the profile unless `plain`
export default function ManagerName({ id, plain, className = "" }: { id: string; plain?: boolean; className?: string }) {
  const inner = (
    <>
      <span aria-hidden className="inline-block h-2.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: MANAGER_COLORS[id] ?? "var(--color-border-strong)" }} />
      <span className="truncate">{id}</span>
    </>
  );
  const cls = `inline-flex min-w-0 items-center gap-2 ${className}`;
  return plain
    ? <span className={cls}>{inner}</span>
    : <Link href={`/manager/${id}`} className={`${cls} hover:text-red transition-colors`}>{inner}</Link>;
}
