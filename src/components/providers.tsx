"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NetworkNotice } from "./safe-drafts";
import { ActionNotice } from "./action-notice";
import { PromptHost } from "./prompt-dialog";
import { AuthProvider, type AuthUser } from "./auth-context";

export function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: AuthUser;
}) {
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
      <AuthProvider initialUser={user}>
        <NetworkNotice />
        <PromptHost />
        <ActionNotice />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
