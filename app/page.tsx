import { connection } from "next/server";
import { ProposalQueue } from "@/components/proposal-queue";
import { getProposalRows } from "@/lib/dashboard/queries";

/**
 * Proposal queue view. Renders at request time so a production build never
 * prerenders frozen seed rows; the client component keeps polling afterwards.
 *
 * @returns The queue page.
 */
export default async function Home() {
  await connection();
  const rows = await getProposalRows();
  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Proposal queue
      </h1>
      <ProposalQueue initialData={rows} />
    </main>
  );
}
