import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

  // BETA-052: keep a ref to the latest load fn so event handlers don't
  // go stale across re-renders.
  const loadRef = useRef<((bypassCache?: boolean) => Promise<void>) | null>(null);

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

  loadRef.current = load;

  // BETA-052: Initial bootstrap fetch on mount (only when no initialState is
  // provided by the server).
  useEffect(() => {
    if (!initialState && state.branch === "loading") {
      void load(false);
    }
  }, [initialState, load, state.branch]);

  // BETA-052: Re-fetch when the user returns to the tab after being away.
  // This catches session expiry, stale data, and server-side state changes
  // without requiring a full page reload.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      // If the user has an active or outage branch (i.e. they completed the
      // initial load), silently re-fetch to check session freshness.
      const current = state.branch;
      if (current !== "loading" && current !== "unauthorized" && loadRef.current) {
        void loadRef.current(false);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state.branch]);

  // BETA-052: Re-fetch when the browser transitions from offline to online.
  useEffect(() => {
    function handleOnline() {
      if (loadRef.current && (state.branch === "outage" || state.branch === "maintenance")) {
        void loadRef.current(false);
      }
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [state.branch]);

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
