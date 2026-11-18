"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="cell mx-auto mt-8 max-w-lg p-6 sm:p-8">
      <h1 className="display-title text-2xl text-ink">Die Seite konnte nicht geladen werden</h1>
      <p className="mt-2 text-base text-text-muted">
        Meist liegt das an einer kurzen Störung der Datenbank. Ein zweiter Versuch reicht in der Regel.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => unstable_retry()}>Erneut versuchen</button>
        <Link href="/" className="btn">Zur Startseite</Link>
      </div>
    </div>
  );
}
