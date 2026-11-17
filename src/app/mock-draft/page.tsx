import { MOCK_DRAFT_OPEN } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import MockDraftPage from "./MockDraftPage";

// While the game is open, saved mocks must show at once: add
// `export const dynamic = "force-dynamic";` here when setting MOCK_DRAFT_OPEN to true.

export default function MockDraft() {
  if (MOCK_DRAFT_OPEN) return <MockDraftPage />;

  return (
    <div>
      <PageHeader title="Mock Draft" description="Das Tippspiel zum NFL Draft." />
      <div className="cell max-w-xl p-6">
        <h2 className="text-lg font-semibold text-ink">Der Mock Draft ruht bis zum nächsten NFL Draft</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Vor dem Draft im April geht es mit den neuen Prospects wieder los. Bis dahin gibt es hier nichts zu tippen.
        </p>
      </div>
    </div>
  );
}
