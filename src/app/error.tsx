"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="display-title text-4xl text-ink">Die Seite konnte nicht geladen werden</h1>
      <p className="mt-3 text-sm text-text-muted">
        Meist liegt das an einer kurzen Störung der Datenbank. Ein zweiter Versuch reicht in der Regel.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => unstable_retry()}>Erneut versuchen</button>
        <Link href="/" className="btn">Zur Startseite</Link>
      </div>
    </div>
  );
}
