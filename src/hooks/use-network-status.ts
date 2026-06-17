import { useEffect, useState } from "react";

/**
 * Hook to track network status (online/offline).
 * Responds within one second of detection.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastChanged, setLastChanged] = useState<number>(Date.now());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChanged(Date.now());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLastChanged(Date.now());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, lastChanged };
}
