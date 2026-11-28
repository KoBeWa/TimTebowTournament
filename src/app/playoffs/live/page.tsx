import PageHeader from "@/components/ui/PageHeader";
import LiveOddsView from "./LiveOddsView";

export const metadata = { title: "Live-Prognose | Tim Tebow Tournament" };

// The numbers come from /api/live-odds in the browser, refreshed every minute
export default function LivePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Live-Prognose" crumbs={[{ label: "Playoff-Chancen", href: "/playoffs" }]}
        description="Die Playoff-Chancen während des Spieltags, jede Minute neu gerechnet." />
      <LiveOddsView />
    </div>
  );
}
