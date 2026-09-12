"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Queue" },
  { href: "/decisions", label: "Decisions" },
] as const;

/**
 * Two-link nav between the proposal queue and the Decision log; the only
 * interactive elements on either view. The active route is underlined so the
 * audience always knows which view is on screen.
 *
 * @returns The nav bar.
 */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-elevated">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-stretch gap-8 px-8">
        <span className="flex items-center font-mono text-sm font-semibold uppercase tracking-widest">
          AI Secretary
        </span>
        <ul className="flex items-stretch gap-6">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center border-b-2 border-transparent font-mono text-sm uppercase tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
