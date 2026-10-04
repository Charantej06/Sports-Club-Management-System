"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NetworkNotice } from "./safe-drafts";
import { PromptHost } from "./prompt-dialog";
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: true },
          mutations: { networkMode: "always", retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <NetworkNotice />
      <PromptHost />
      {children}
    </QueryClientProvider>
  );
}
