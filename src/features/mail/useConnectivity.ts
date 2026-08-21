import { useEffect, useState } from "react";

import { readDocumentVisible, readNavigatorOnline, shouldPauseSync } from "@/lib/api";

export function useConnectivity() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : readNavigatorOnline(navigator),
  );
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : readDocumentVisible(document),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onVisibility = () => setVisible(readDocumentVisible(document));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    setOnline(readNavigatorOnline(navigator));
    setVisible(readDocumentVisible(document));
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    online,
    visible,
    paused: shouldPauseSync(online, visible),
  };
}
