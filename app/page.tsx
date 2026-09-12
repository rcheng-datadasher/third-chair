import { connection } from "next/server";
import { ProposalQueue } from "@/components/proposal-queue";
import { SceneHeader } from "@/components/scene-header";
import { getProposalRows } from "@/lib/dashboard/queries";

/**
 * Proposal queue scene. Renders at request time so a production build never
 * prerenders frozen seed rows; the client grid keeps polling afterwards.
 *
 * @returns The queue page.
 */
export default async function Home() {
  await connection();
  const rows = await getProposalRows();
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SceneHeader title="Proposal queue">
        Every meeting the agent has proposed from Slack, newest first. Approval
        happens on the Slack card, not here.
      </SceneHeader>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-6 md:px-6">
        <ProposalQueue initialData={rows} />
      </div>
    </main>
  );
}
