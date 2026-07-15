import * as React from "react";

import type { User } from "./types";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  refetch: () => Promise<unknown>;
}

export const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);
