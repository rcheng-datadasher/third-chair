"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Root client providers. Holds one QueryClient per browser session; library
 * injection only, never app state (that lives in Zustand stores).
 *
 * @param props - Provider props.
 * @param props.children - The app subtree.
 * @returns The subtree wrapped in a QueryClientProvider.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
