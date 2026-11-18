import Link from "next/link";

export default function NotFound() {
  return (
    <div className="cell mx-auto mt-8 max-w-lg p-6 sm:p-8">
      <h1 className="display-title text-2xl text-ink">Diese Seite gibt es nicht</h1>
      <p className="mt-2 text-base text-text-muted">Der Link ist veraltet oder vertippt.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className="btn-primary">Zur Startseite</Link>
        <Link href="/gamecenter" className="btn">Zum Gamecenter</Link>
      </div>
    </div>
  );
}
