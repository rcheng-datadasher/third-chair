import type { Metadata } from "next";
import { connection } from "next/server";
import { DecisionLog } from "@/components/decision-log";
import { SceneHeader } from "@/components/scene-header";
import { getDecisionRows } from "@/lib/dashboard/queries";

export const metadata: Metadata = { title: "Decisions" };

/**
 * Decision log scene: the agent's own acted/ignored decisions, nothing else.
 *
 * @returns The decisions page.
 */
export default async function DecisionsPage() {
  await connection();
  const rows = await getDecisionRows();
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SceneHeader title="Decision log">
        What the agent chose to act on or ignore, with the reason it gave.
        Ignored messages stay visible so the reasoning can be checked.
      </SceneHeader>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-6 md:px-6">
        <DecisionLog initialData={rows} />
      </div>
    </main>
  );
}
