import { connection } from "next/server";
import { DecisionLog } from "@/components/decision-log";
import { getDecisionRows } from "@/lib/dashboard/queries";

/**
 * Decision log view: the agent's own acted/ignored decisions, nothing else.
 *
 * @returns The decisions page.
 */
export default async function DecisionsPage() {
  await connection();
  const rows = await getDecisionRows();
  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Decision log
      </h1>
      <DecisionLog initialData={rows} />
    </main>
  );
}
