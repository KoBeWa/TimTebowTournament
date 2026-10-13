import {
  ArrowLeftRight,
  Award,
  ChartBar,
  ListOrdered,
  Swords,
  Target,
  Trophy,
  Tv,
  type LucideProps,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";

const ICONS = {
  trophy: Trophy,
  "bar-chart": ChartBar,
  tv: Tv,
  "list-ordered": ListOrdered,
  "arrow-left-right": ArrowLeftRight,
  swords: Swords,
  award: Award,
  target: Target,
} as const;

export default function NavIcon({
  name,
  ...props
}: { name: (typeof NAV_ITEMS)[number]["icon"] } & LucideProps) {
  const Icon = ICONS[name];
  return <Icon {...props} />;
}
