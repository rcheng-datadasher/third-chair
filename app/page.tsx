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
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-8 pt-10 pb-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Proposal queue
        </h1>
        <p className="text-base text-muted-foreground">
          Every meeting the agent has proposed from Slack, newest first.
          Approval happens on the Slack card, not here.
        </p>
      </header>
      <ProposalQueue initialData={rows} />
    </main>
  );
}
