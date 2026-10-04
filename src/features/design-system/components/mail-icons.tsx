import { forwardRef, type ReactNode } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

function mailIcon(name: string, drawing: ReactNode): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    (
      { size = 24, color = "currentColor", strokeWidth = 1.8, absoluteStrokeWidth, ...props },
      ref,
    ) => (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={
          absoluteStrokeWidth && Number(size) > 0
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        data-mail-icon={name}
        {...props}
      >
        {drawing}
      </svg>
    ),
  );
  Icon.displayName = `Mail${name}Icon`;
  return Icon;
}

// A shared 24px postal family: clipped corners, open frames and inset ink details.
export const ComposeIcon = mailIcon(
  "compose",
  <>
    <path d="M5 8v11h11v-5M4 20h13" />
    <path d="m14 3 7 7-8 7-4 1 1-4Z" fill="currentColor" fillOpacity="0.12" />
    <path d="m14 3-1 6 2 2 6-1M13 11l-4 7" />
  </>,
);

export const SearchIcon = mailIcon(
  "search",
  <>
    <rect x="4" y="3.5" width="13" height="13" rx="5" />
    <path d="m16 15.5 5 5M7.5 7.5h3" />
  </>,
);

export const FilterIcon = mailIcon(
  "filter",
  <>
    <path d="M3 5h18M6 9h12M9 13h6M12 13v7" />
    <path d="m10 18 2 2 2-2" />
  </>,
);

export const NotificationsIcon = mailIcon(
  "notifications",
  <>
    <path d="M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4ZM10 20h4" />
    <path d="m3 9 1-3m17 3-1-3M12 3v2" />
  </>,
);

export const SettingsIcon = mailIcon(
  "settings",
  <>
    <path d="M8 4a8.5 8.5 0 0 1 12 8M16 20A8.5 8.5 0 0 1 4 12M12 2v3m10 7h-3M12 22v-3M2 12h3" />
    <path d="m12 8 4 4-4 4-4-4Z" fill="currentColor" fillOpacity="0.12" />
  </>,
);

export const ImportIcon = mailIcon(
  "import",
  <>
    <path d="M4 13v6h16v-6M4 19l3-3h10l3 3M12 3v10m-4-4 4 4 4-4" />
  </>,
);

export const HelpIcon = mailIcon(
  "help",
  <>
    <path d="m12 3 8 4v10l-8 4-8-4V7Z" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" />
  </>,
);

export const ProofIcon = mailIcon(
  "proof",
  <>
    <path d="m12 3 7 3v8l-7 7-7-7V6Z" fill="currentColor" fillOpacity="0.1" />
    <path d="m8.5 11 2.5 2.5 4.5-5M9 18v3m6-3v3" />
  </>,
);

export const LaterIcon = mailIcon(
  "later",
  <>
    <path d="M5 6a8 8 0 1 1-1 10M3 4v5h5M12 7v5l4 2" />
    <path d="M8 20h1" />
  </>,
);

export const FilesIcon = mailIcon(
  "files",
  <>
    <path d="M8 3h8l4 4v12H8ZM16 3v5h4M4 7v14h11M11 12h6m-6 4h4" />
  </>,
);

export const CalendarIcon = mailIcon(
  "calendar",
  <>
    <path d="M5 5h15v15H4V6Zm3-2v5m8-5v5M4 10h16" />
    <path d="M8 14h3v3H8Zm7 0h1m-1 3h1" fill="currentColor" fillOpacity="0.12" />
  </>,
);

export const InboxIcon = mailIcon(
  "inbox",
  <>
    <path d="m7 4-4 9v7h18v-7l-4-9M3 13h5l2 3h4l2-3h5" />
    <path d="M9 6h6M9 9h6" />
  </>,
);

export const AllMailIcon = mailIcon(
  "all-mail",
  <>
    <path d="M4 8h16v12H4Zm0 0 8 6 8-6M7 4h13M7 4v1" />
  </>,
);

export const PriorityIcon = mailIcon(
  "priority",
  <>
    <path
      d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5Z"
      fill="currentColor"
      fillOpacity="0.12"
    />
    <path d="M20 3v4m-2-2h4M20 17v3" />
  </>,
);

export const StarredIcon = mailIcon(
  "starred",
  <>
    <path
      d="m12 3 3 6 6.5 1-4.5 4.5 1 6.5-6-3-6 3 1-6.5L2.5 10 9 9Z"
      fill="currentColor"
      fillOpacity="0.12"
    />
    <path d="m12 7-1.5 4" />
  </>,
);

export const DraftIcon = mailIcon(
  "draft",
  <>
    <path d="M8 3h11v18H5V6Zm0 0v4H5M9 11h6m-6 4h6m-6 3h3" />
  </>,
);

export const SentIcon = mailIcon(
  "sent",
  <>
    <path d="m8 5 13-2-3 14-5-5-5-7Zm5 7 8-9M3 11h4m-2 5h4m-2 5h4" />
  </>,
);

export const ContactsIcon = mailIcon(
  "contacts",
  <>
    <path d="M4 4h11v9H4Zm11 3h5v9h-7M2 20c0-3 3-5 7-5s7 2 7 5m0-3c3 0 5 1 5 3" />
    <circle cx="9.5" cy="8.5" r="2" fill="currentColor" fillOpacity="0.12" />
  </>,
);

export const IdentityIcon = mailIcon(
  "identity",
  <>
    <path d="m12 3 8 4v10l-8 4-8-4V7Z" />
    <circle cx="12" cy="9" r="2.5" />
    <path d="M8 17v-1a4 4 0 0 1 8 0v1" />
  </>,
);

export const EncryptedIcon = mailIcon(
  "encrypted",
  <>
    <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12l2 2v7l-2 2H6l-2-2v-7Z" />
    <path d="M12 14v3M7 17h1m8 0h1" />
  </>,
);

export const ReceiptIcon = mailIcon(
  "receipt",
  <>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
    <path d="m9 8 2 2 4-4M9 14h6" />
  </>,
);

export const ArchiveIcon = mailIcon(
  "archive",
  <>
    <path d="M3 5h18v5H3Zm2 5v11h14V10M9 14h6" />
    <path d="M7 3h10" />
  </>,
);

export const SpamIcon = mailIcon(
  "spam",
  <>
    <path d="m8 3-5 5v8l5 5h8l5-5V8l-5-5Z" />
    <path d="M12 7v6m0 4h.01" />
  </>,
);

export const TrashIcon = mailIcon(
  "trash",
  <>
    <path d="m3 6 17-2M7 4l1-2h6l1 2M5 8l1 13h12l1-14M9 10v7m5-7v7" />
  </>,
);

export const FolderIcon = mailIcon(
  "folder",
  <>
    <path d="M3 7V4h7l3 3h8v13H3Zm0 4h18M7 16h4" />
  </>,
);
