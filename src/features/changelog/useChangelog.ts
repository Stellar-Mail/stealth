import { useState, useCallback } from "react";
import { CHANGELOG_ENTRIES, LATEST_VERSION } from "./data";

const STORAGE_KEY = "stealth:changelog:seen-version";

function getSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setSeenVersion(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // ignore
  }
}

export function useChangelog() {
  const [seenVersion, setSeenVersionState] = useState<string | null>(getSeenVersion);
  const [initialSeenVersion] = useState<string | null>(seenVersion);

  const hasUnread = initialSeenVersion !== LATEST_VERSION;

  const markAllSeen = useCallback(() => {
    setSeenVersion(LATEST_VERSION);
    setSeenVersionState(LATEST_VERSION);
  }, []);

  const isEntryUnread = useCallback(
    (entryVersion: string) => {
      if (!initialSeenVersion) return true;
      return entryVersion > initialSeenVersion;
    },
    [initialSeenVersion],
  );

  return { entries: CHANGELOG_ENTRIES, hasUnread, markAllSeen, isEntryUnread };
}
