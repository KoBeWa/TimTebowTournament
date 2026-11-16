import type { ManagerId } from "@/lib/constants";
import { loadPair, loadPairs } from "./data";
import HeadToHead from "./HeadToHead";

// The league matrix and the default pairing are rendered on the server; other pairs load in the browser.
// A failed query throws, so a stale copy of the page stays up instead of an empty one.
const DEFAULT_PAIR: [ManagerId, ManagerId] = ["Benni", "Erik"];

export default async function HeadToHeadPage() {
  const [pairs, pair] = await Promise.all([loadPairs(), loadPair(...DEFAULT_PAIR)]);
  return <HeadToHead initial={{ m1: DEFAULT_PAIR[0], m2: DEFAULT_PAIR[1], pairs, ...pair }} />;
}
