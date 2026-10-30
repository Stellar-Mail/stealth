import { useId } from "react";

export type ToolIconName =
  | "calendar"
  | "people"
  | "files"
  | "saved"
  | "followups"
  | "proofs"
  | "tasks"
  | "notes";

const colors: Record<ToolIconName, [string, string]> = {
  calendar: ["#80c9ff", "#4279df"],
  people: ["#ffba91", "#da7454"],
  files: ["#c6b6ff", "#8972d8"],
  saved: ["#ffe09c", "#d69a3c"],
  followups: ["#8de5df", "#309d9b"],
  proofs: ["#a3deb3", "#4a9e70"],
  tasks: ["#9cbcff", "#597bd0"],
  notes: ["#f6dc8f", "#c7a14b"],
};

// Small, local two-tone illustrations. No icon-font or remote image dependency.
export function ToolIcon({ name }: { name: ToolIconName }) {
  const id = useId();
  const [light, dark] = colors[name];
  const fill = `url(#${id})`;
  return (
    <svg viewBox="0 0 28 28" className="mail-tool-art" aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={id} x1="5" y1="3" x2="24" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {name === "calendar" && (
        <>
          <path d="M7 5h16v19H7z" fill={dark} opacity=".5" />
          <path d="M4 7a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v13l-5 5H7a3 3 0 0 1-3-3Z" fill={fill} />
          <path d="M18 25v-5h5" fill="#e5f3ff" />
          <path d="M4 10h19M9 2v5m9-5v5" stroke="#193c72" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 14h4v3H8zm7 0h4v3h-4zm-7 6h4v2H8z" fill="#f0f8ff" />
        </>
      )}
      {name === "people" && (
        <>
          <path d="M5 8 19 3l5 15-14 6Z" fill={dark} opacity=".55" />
          <rect x="4" y="5" width="18" height="21" rx="4" fill={fill} />
          <path d="M22 10h2m-2 5h2m-2 5h2" stroke={light} strokeWidth="2" strokeLinecap="round" />
          <circle cx="13" cy="12" r="3.2" fill="#60372e" />
          <path d="M7 22a6 6 0 0 1 12 0" fill="#60372e" />
          <path d="M11 18h4l-2 4Z" fill="#ffeade" />
        </>
      )}
      {name === "files" && (
        <>
          <path d="m3 8 14-5 6 19-14 4Z" fill={dark} opacity=".65" />
          <path d="M8 3h10l6 6v15H8Z" fill={fill} />
          <path d="M18 3v6h6" fill="#efe9ff" />
          <path
            d="M12 14h8m-8 4h6m-6 4h4"
            stroke="#413469"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {name === "saved" && (
        <>
          <path d="M9 3h15v21l-7-4-8 4Z" fill={dark} opacity=".4" />
          <path d="M5 3h15a2 2 0 0 1 2 2v20l-8.5-5-8.5 5V5a2 2 0 0 1 2-2Z" fill={fill} />
          <path
            d="m13.5 7 1.7 3.3 3.7.5-2.7 2.6.6 3.6-3.3-1.7-3.3 1.7.6-3.6-2.7-2.6 3.7-.5Z"
            fill="#6a471b"
          />
        </>
      )}
      {name === "followups" && (
        <>
          <path d="m8 2-5 5m17-5 5 5" stroke={dark} strokeWidth="3" strokeLinecap="round" />
          <circle cx="14" cy="15" r="10.5" fill={fill} />
          <circle cx="14" cy="15" r="7.5" stroke="#e1ffff" strokeOpacity=".8" />
          <path
            d="M14 9v6l4 2"
            stroke="#195553"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m6 24-1 2m17-2 1 2" stroke={dark} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {name === "proofs" && (
        <>
          <path d="m14 2 10 4v8c0 6-10 12-10 12S4 20 4 14V6Z" fill={fill} />
          <path
            d="m14 5 7 3v6c0 4-7 9-7 9"
            stroke="#e6fff0"
            strokeOpacity=".75"
            strokeWidth="1.2"
          />
          <path
            d="m9 13 3.5 3.5 6-6"
            stroke="#215c3a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {name === "tasks" && (
        <>
          <rect x="4" y="4" width="20" height="22" rx="4" fill={fill} />
          <rect x="9" y="2" width="10" height="5" rx="2" fill="#d9e6ff" />
          <path
            d="m8 12 2 2 3-4m-5 9 2 2 3-4"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M16 12h4m-4 7h4" stroke="#294673" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {name === "notes" && (
        <>
          <path d="m5 3 19 2-2 20-19-2Z" fill={dark} opacity=".45" />
          <path d="M5 3h19v16l-6 6H5Z" fill={fill} />
          <path d="M18 25v-6h6" fill="#fff1c5" />
          <path
            d="M9 9h11M9 13h9M9 17h6"
            stroke="#735926"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
