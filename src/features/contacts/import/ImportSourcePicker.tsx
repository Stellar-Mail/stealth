import { useState, useRef, useCallback } from "react";
import { Upload, Mail, BookUser, Terminal, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportSource } from "./types";

type Props = {
  onSelectSource: (source: ImportSource, raw?: string) => void;
};

type SourceOption = {
  id: ImportSource;
  label: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
};

const SOURCES: SourceOption[] = [
  {
    id: "csv",
    label: "CSV file",
    description: "Upload or paste a CSV with name and address columns",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    id: "provider-gmail",
    label: "Google Contacts",
    description: "Import from your Google account",
    icon: <Mail className="h-5 w-5" />,
    disabled: true,
    badge: "Coming soon",
  },
  {
    id: "provider-outlook",
    label: "Outlook Contacts",
    description: "Import from your Microsoft account",
    icon: <Mail className="h-5 w-5" />,
    disabled: true,
    badge: "Coming soon",
  },
  {
    id: "contacts-api",
    label: "Contacts API",
    description: "Import via API or address book file",
    icon: <BookUser className="h-5 w-5" />,
    disabled: true,
    badge: "Coming soon",
  },
  {
    id: "manual",
    label: "Type manually",
    description: "Enter contacts one at a time",
    icon: <Terminal className="h-5 w-5" />,
  },
];

export function ImportSourcePicker({ onSelectSource }: Props) {
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<"pick" | "csv-input">("pick");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setCsv(e.target?.result as string);
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (mode === "csv-input") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Import from CSV</h2>
            <p className="text-sm text-muted-foreground">
              Upload a .csv file or paste comma-separated values.
            </p>
          </div>
          <button
            onClick={() => {
              setMode("pick");
              setCsv("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Back to sources
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 transition hover:bg-white/[0.04]"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drag & drop a <span className="text-foreground">.csv</span> file or click to browse
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={`name,address\nAlice,alice*stealth.xyz\nBob,GABCDEFGHJK…`}
          rows={5}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none resize-none focus:border-white/20"
        />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Columns: <code className="rounded bg-white/[0.06] px-1">name,address</code> or just{" "}
            <code className="rounded bg-white/[0.06] px-1">address</code>
          </span>
          <span>{csv ? `${csv.split(/\r?\n/).filter(Boolean).length} lines` : ""}</span>
        </div>

        <button
          onClick={() => {
            if (csv.trim()) onSelectSource("csv", csv);
          }}
          disabled={!csv.trim()}
          className={cn(
            "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            csv.trim()
              ? "bg-foreground text-background hover:opacity-90"
              : "cursor-not-allowed bg-white/10 text-muted-foreground",
          )}
        >
          Parse contacts
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Import contacts</h2>
        <p className="text-sm text-muted-foreground">
          Choose where to import from. No trust is granted automatically — you will review every
          assignment.
        </p>
      </div>

      <div className="grid gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              if (s.disabled) return;
              if (s.id === "csv") {
                setMode("csv-input");
              } else {
                onSelectSource(s.id);
              }
            }}
            disabled={s.disabled}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
              s.disabled
                ? "border-white/5 opacity-40 cursor-not-allowed"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/20",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-muted-foreground">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.description}</span>
            </div>
            {s.badge && (
              <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
