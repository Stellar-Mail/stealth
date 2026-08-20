import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import {
  fetchBootstrap,
  getCachedBootstrap,
  type BootstrapBranch,
  type BootstrapData,
  type BootstrapError,
  type BootstrapState,
} from "./bootstrap";

export interface BootstrapContextValue {
  data: BootstrapData | null;
  branch: BootstrapBranch;
  isLoading: boolean;
  error: BootstrapError | null;
  retry: () => Promise<void>;
  isRetrying: boolean;
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: BootstrapState;
}) {
  const cached = getCachedBootstrap();
  const [state, setState] = useState<BootstrapState>(
    initialState ??
      cached ?? {
        data: null,
        branch: "loading",
        isLoading: true,
        error: null,
        timestamp: null,
      },
  );
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async (bypassCache = false) => {
    if (bypassCache) {
      setIsRetrying(true);
    } else {
      setState((prev) => ({ ...prev, isLoading: true }));
    }

    try {
      const next = await fetchBootstrap({ bypassCache });
      setState(next);
    } catch {
      setState({
        data: null,
        branch: "outage",
        isLoading: false,
        error: {
          code: "network_error",
          message: "Failed to initialize application session.",
          retryable: true,
        },
        timestamp: Date.now(),
      });
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    if (!initialState && state.branch === "loading") {
      void load(false);
    }
  }, [initialState, load, state.branch]);

  const retry = useCallback(async () => {
    await load(true);
  }, [load]);

  const value: BootstrapContextValue = {
    data: state.data,
    branch: state.branch,
    isLoading: state.isLoading,
    error: state.error,
    retry,
    isRetrying,
  };

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapContextValue {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error("useBootstrap must be used within a BootstrapProvider");
  }
  return context;
}
