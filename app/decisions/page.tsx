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
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-8 pt-10 pb-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Decision log</h1>
        <p className="text-base text-muted-foreground">
          What the agent chose to act on or ignore, with the reason it gave.
          Ignored messages stay visible so the reasoning can be checked.
        </p>
      </header>
      <DecisionLog initialData={rows} />
    </main>
  );
}
