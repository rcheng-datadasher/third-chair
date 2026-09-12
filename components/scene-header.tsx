import type { ReactNode } from "react";

/**
 * PostHog-style scene header: the view title and a one-line explanation,
 * separated from the data below by a hard rule.
 *
 * @param props - Header props.
 * @param props.title - The scene title, rendered as the page's only `h1`.
 * @param props.children - One or two sentences saying what the scene shows.
 * @returns The scene header.
 */
export function SceneHeader({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 border-b px-4 py-5 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h1>
      <p className="max-w-prose text-base text-muted-foreground">{children}</p>
    </header>
  );
}
