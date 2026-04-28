/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchCurrentCustomer } from "@/lib/client/shopifyClient";

const AuthContext = createContext({
  customer: null,      // { id, firstName, lastName, emailAddress: { emailAddress } } | null
  loading: true,
  refetch: () => {},
});

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const data = await fetchCurrentCustomer();
      setCustomer(data.customer ?? null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ customer, loading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
