import { useState, useCallback } from "react";
import { CHANGELOG_ENTRIES, LATEST_VERSION } from "./data";
import {
  getSeenVersion,
  setSeenVersion,
  isEntryUnread as isEntryUnreadHelper,
  hasUnreadEntries,
} from "./helpers";

export function useChangelog() {
  const [seenVersion, setSeenVersionState] = useState<string | null>(getSeenVersion);
  const [initialSeenVersion] = useState<string | null>(seenVersion);

  const hasUnread = hasUnreadEntries(LATEST_VERSION, seenVersion);

  const markAllSeen = useCallback(() => {
    setSeenVersion(LATEST_VERSION);
    setSeenVersionState(LATEST_VERSION);
  }, []);

  const isEntryUnread = useCallback(
    (entryVersion: string) => {
      return isEntryUnreadHelper(entryVersion, initialSeenVersion);
    },
    [initialSeenVersion],
  );

  return { entries: CHANGELOG_ENTRIES, hasUnread, markAllSeen, isEntryUnread };
}
