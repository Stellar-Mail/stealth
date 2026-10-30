import { useCallback, useEffect, useMemo, useState } from "react";

import {
  defaultMailFilters,
  type Email,
  type MailFilters,
  type MailFolder,
} from "@/components/mail/data";
import { buildFolderCounts, nextSelectedId, visibleEmailsFor } from "./navigation";

export function useMailNavigation(emails: Email[], liveCounts?: Record<MailFolder, number> | null) {
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [customFolder, updateCustomFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<MailFilters>(defaultMailFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "reader">("list");

  const folderCounts = useMemo(() => liveCounts ?? buildFolderCounts(emails), [emails, liveCounts]);
  const visibleEmails = useMemo(
    () => visibleEmailsFor(emails, folder, customFolder),
    [customFolder, emails, folder],
  );
  const selectedEmails = useMemo(
    () => visibleEmails.filter((email) => selectedIds.includes(email.id)),
    [selectedIds, visibleEmails],
  );
  const visibleSelectedId = nextSelectedId(visibleEmails, selectedId);
  const selected = visibleEmails.find((email) => email.id === visibleSelectedId) ?? null;

  const closeMessage = useCallback(() => {
    setSelectedId(null);
    setMobileView("list");
  }, []);

  const setCustomFolder = useCallback((next: string | null) => {
    updateCustomFolder(next);
    setSelectedId(null);
    setSelectedIds([]);
    setMobileView("list");
  }, []);

  const selectFolder = useCallback((next: MailFolder) => {
    setFolder(next);
    updateCustomFolder(null);
    setSelectedId(null);
    setSelectedIds([]);
    setMobileView("list");
  }, []);

  const openMessage = useCallback((email: Email) => {
    updateCustomFolder(null);
    setFilters(defaultMailFilters);
    setFolder(email.folder);
    setSelectedId(email.id);
    setSelectedIds([]);
    setMobileView("reader");
  }, []);

  useEffect(() => {
    setSelectedId((current) => nextSelectedId(visibleEmails, current));
  }, [visibleEmails]);

  return {
    folder,
    setFolder,
    customFolder,
    setCustomFolder,
    filters,
    setFilters,
    selectedId: visibleSelectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    folderCounts,
    visibleEmails,
    selectedEmails,
    selected,
    selectFolder,
    openMessage,
    closeMessage,
    mobileView,
    setMobileView,
  };
}
