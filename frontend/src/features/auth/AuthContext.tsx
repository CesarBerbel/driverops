import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import * as React from "react";

import { fetchMe, login as apiLogin, logout as apiLogout } from "./api";
import { AuthContext, type AuthContextValue } from "./auth-context";

const ME_QUERY_KEY = ["auth", "me"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch (error) {
        // Only a genuine 401 (the interceptor already tried to refresh and
        // failed) means "not authenticated". Any other failure -- a network
        // blip, a 5xx, or the backend restarting -- must NOT drop the session:
        // re-throw so React Query keeps the previous user instead of logging
        // the user out mid-work.
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  React.useEffect(() => {
    function handleSessionExpired() {
      queryClient.setQueryData(ME_QUERY_KEY, null);
    }
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [queryClient]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const loggedInUser = await apiLogin(email, password);
      queryClient.setQueryData(ME_QUERY_KEY, loggedInUser);
      return loggedInUser;
    },
    [queryClient],
  );

  const logout = React.useCallback(async () => {
    await apiLogout();
    queryClient.setQueryData(ME_QUERY_KEY, null);
  }, [queryClient]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    refetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
