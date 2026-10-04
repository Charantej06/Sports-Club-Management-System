"use client";

import { createContext, useContext, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { setActiveCartUserId } from "@/lib/cart-store";

export type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

const AuthContext = createContext<{ user: AuthUser }>({ user: null });

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser;
}) {
  const session = authClient.useSession();
  const rawUser = (session.data?.user ?? null) as
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
      }
    | null;

  const currentUser: AuthUser = rawUser
    ? {
        id: rawUser.id,
        name: rawUser.name,
        email: rawUser.email,
        role: rawUser.role,
      }
    : session.isPending
      ? initialUser
      : null;

  useEffect(() => {
    setActiveCartUserId(currentUser?.id ?? null);
  }, [currentUser?.id]);

  return (
    <AuthContext.Provider value={{ user: currentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useCurrentUser(): AuthUser {
  return useContext(AuthContext).user;
}
