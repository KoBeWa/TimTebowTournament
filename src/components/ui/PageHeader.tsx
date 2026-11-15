import Link from "next/link";
import { ChevronRight } from "lucide-react";

// One header for every page: optional breadcrumb, title, one line of context, actions on the right
export default function PageHeader({ title, description, crumbs, children }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: { label: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Pfad" className="mb-2 flex items-center gap-1 text-sm text-text-muted">
          {crumbs.map((c) => (
            <span key={c.href} className="flex items-center gap-1">
              <Link href={c.href} className="hover:text-ink transition-colors">{c.label}</Link>
              <ChevronRight size={14} className="text-text-faint" />
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="display-title text-4xl sm:text-5xl text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{description}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
