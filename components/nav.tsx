"use client";

import { Handshake, Inbox, ScrollText, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Queue", Icon: Inbox },
  { href: "/decisions", label: "Decisions", Icon: ScrollText },
  { href: "/graph", label: "Graph", Icon: Waypoints },
  { href: "/commitments", label: "Commitments", Icon: Handshake },
] as const;

/**
 * App shell navigation in the PostHog pattern: a fixed left sidebar on
 * desktop that collapses to a top bar below `md`. Its two links are the only
 * interactive elements on either view; the active route is a filled amber-text row.
 *
 * @returns The sidebar / top bar.
 */
export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 items-stretch border-b bg-elevated md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center whitespace-nowrap px-4 font-mono text-sm font-semibold uppercase tracking-widest md:h-14 md:border-b md:px-5">
        AI Secretary
      </div>
      <nav
        aria-label="Views"
        className="flex flex-1 overflow-x-auto md:flex-col md:py-3"
      >
        <ul className="flex flex-1 md:flex-col md:gap-0.5 md:px-2">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-1 items-center gap-2.5 border border-transparent px-4 font-mono text-sm uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-10 md:rounded-lg md:px-3",
                    active
                      ? "border-border bg-background text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="hidden border-t px-5 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground md:block">
        Read-only · approvals live in Slack
      </p>
    </aside>
  );
}
