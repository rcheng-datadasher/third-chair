import { LedgerSurface } from "@/components/commitment-ledger/ledger-surface";

/**
 * The commitment ledger page (Phase 8, STR-04/STR-05). Reached only by
 * typing its URL — no nav link is added (D-15). Server Component wrapping
 * the client chat surface.
 *
 * @returns The commitment ledger route.
 */
export default function CommitmentsPage() {
  return <LedgerSurface />;
}
