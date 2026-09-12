import Link from "next/link";

const linkClass =
  "font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Two-link nav between the proposal queue and the Decision log; the only
 * interactive elements on either view.
 *
 * @returns The nav bar.
 */
export function Nav() {
  return (
    <nav className="flex items-center gap-6 border-b px-6 py-3">
      <span className="font-mono text-xs uppercase tracking-widest">
        AI Secretary
      </span>
      <Link href="/" className={linkClass}>
        Queue
      </Link>
      <Link href="/decisions" className={linkClass}>
        Decisions
      </Link>
    </nav>
  );
}
