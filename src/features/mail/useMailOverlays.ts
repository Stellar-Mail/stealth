import { useCallback, useState } from "react";

import type { UiPreferences } from "@/features/preferences";

export function useMailOverlays() {
  const [showSenderJourney, setShowSenderJourney] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<{
    to?: string;
    subject?: string;
    body?: string;
    draftId?: string | null;
    version?: number;
  }>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const [calendarCreateRequest, setCalendarCreateRequest] = useState(0);
  const [settingsSnapshot, setSettingsSnapshot] = useState<UiPreferences | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{
    name: string;
    size: string;
    type: string;
    /** The email this attachment belongs to (for provenance display). */
    senderAddress?: string;
    /** Encrypted ciphertext (base64) from the sealed envelope. */
    encryptedCiphertext?: string;
    /** Hex-encoded 12-byte nonce from the attachment's encryption_metadata. */
    encryptedNonce?: string;
    /** Hex-encoded 16-byte GCM tag from the attachment's encryption_metadata. */
    encryptedMac?: string;
    /** Expected SHA-256 hex content hash for integrity verification. */
    expectedContentHash?: string;
    /** The AES-GCM content key for decryption (CryptoKey object). */
    contentKey?: CryptoKey;
  } | null>(null);
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [proofInspectorOpen, setProofInspectorOpen] = useState(false);
  const [proofInspectorQuery, setProofInspectorQuery] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const openCompose = useCallback(
    (
      initial: {
        to?: string;
        subject?: string;
        body?: string;
        draftId?: string | null;
        version?: number;
      } = {},
    ) => {
      setComposeInitial(initial);
      setComposeOpen(true);
    },
    [],
  );

  const openSettings = useCallback((preferences: UiPreferences) => {
    setSettingsSnapshot(preferences);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsSnapshot(null);
  }, []);

  const openCalendar = useCallback((eventId?: string | null) => {
    setCalendarEventId(eventId ?? null);
    setCalendarOpen(true);
  }, []);

  const requestCalendarCreate = useCallback(() => {
    setCalendarEventId(null);
    setCalendarOpen(true);
    setCalendarCreateRequest((request) => request + 1);
  }, []);

  const openProofInspector = useCallback((query = "") => {
    setProofInspectorQuery(query);
    setProofInspectorOpen(true);
  }, []);

  return {
    showSenderJourney,
    setShowSenderJourney,
    composeOpen,
    setComposeOpen,
    composeInitial,
    paletteOpen,
    setPaletteOpen,
    settingsOpen,
    importOpen,
    setImportOpen,
    calendarOpen,
    setCalendarOpen,
    calendarEventId,
    calendarCreateRequest,
    settingsSnapshot,
    setSettingsSnapshot,
    previewAttachment,
    setPreviewAttachment,
    shortcutOverlayOpen,
    setShortcutOverlayOpen,
    proofInspectorOpen,
    setProofInspectorOpen,
    proofInspectorQuery,
    authModalOpen,
    setAuthModalOpen,
    openCompose,
    openSettings,
    closeSettings,
    openCalendar,
    requestCalendarCreate,
    openProofInspector,
  };
}

export type MailOverlays = ReturnType<typeof useMailOverlays>;
