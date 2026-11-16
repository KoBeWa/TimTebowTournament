import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="display-title text-4xl text-ink">Diese Seite gibt es nicht</h1>
      <p className="mt-3 text-sm text-text-muted">Der Link ist veraltet oder vertippt.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn-primary">Zur Startseite</Link>
        <Link href="/gamecenter" className="btn">Zum Gamecenter</Link>
      </div>
    </div>
  );
}
