import React, { useState, useEffect } from "react";
import {
  Download,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Braces,
  Lock,
  File,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Eye,
  FileCode,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Mock database of file contents
const MOCK_FILE_CONTENTS: Record<string, string | { [key: string]: any }> = {
  "vantage-identity-v3.pdf": {
    title: "Vantage Brand Guidelines - Q2 Refresh",
    pages: [
      {
        pageNumber: 1,
        title: "1. Brand Identity Overview",
        content: `Vantage Studio brand identity refresh focuses on clean typography, monochrome styling, and adaptive dark mode execution.

Core Identity Pillars:
- Minimalism: Zero-noise layouts, intentional white space, and clear content hierarchies.
- Precision: Grid-aligned elements, proportional typography using the Inter font family.
- Adaptability: Seamless transition between light and dark themes with consistent semantic tokens.

Design Guidelines:
Always respect the aspect ratio of the logo. Do not skew or stretch the brand mark. The primary background should default to #09090b (Zinc 950) in dark environments and #ffffff in light environments.`,
      },
      {
        pageNumber: 2,
        title: "2. Color & Typography Palette",
        content: `Brand Typography Scale:
- Display H1: Inter SemiBold, 36px, tracking -0.02em
- Heading H2: Inter Medium, 24px, tracking -0.01em
- Body Regular: Inter Regular, 14px, leading 1.6
- Mono/Code: JetBrains Mono, 12px, leading 1.5

Primary Color Palette:
- Neutral Dark: #09090b (Background Primary)
- Neutral Light: #f4f4f5 (Background Secondary)
- Accent Emerald: #10b981 (Success / Verified States)
- Accent Sky: #0ea5e9 (Security / Protocol States)
- Accent Amber: #f59e0b (Warning / Pending States)`,
      },
      {
        pageNumber: 3,
        title: "3. Motion & Interaction Principles",
        content: `Interaction design should feel responsive and alive. Micro-animations enhance engagement and clarify UI transitions.

Animation Guidelines:
- Hover States: Standard hover duration is 150ms with ease-out curve. Scale elements by 1.02x for tactile feedback.
- Page Transitions: Use Framer Motion's AnimatePresence for layout morphing. Fade in with a slight vertical slide of 8px.
- Spring Physics: Use spring-based animations for modals and drawers (stiffness: 300, damping: 30) to feel natural.`,
      },
    ],
  },
  "payload-test-vector.json": {
    version: "1.0.0",
    algorithm: "Curve25519-XSalsa20-Poly1305",
    header: {
      sender: "GDQ7...X4KJ",
      recipient: "GCKN...N4XQ",
      timestamp: "2026-06-16T15:18:22Z",
      postage_attached: "0.00010 XLM",
      sequence: 142857,
    },
    payload_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    delivery_proof: {
      ledger: 52891244,
      transaction_hash: "48fb7b22d10a6ea9f323a67d022427ae41e4649b934ca495991b7852b855e902",
      relay_node: "Relay Node 07",
    },
    encrypted_body:
      "U2VjcmV0IHBheWxvYWQgdGVzdCB2ZWN0b3IgZm9yIGRlYnVnZ2luZy4gVGhpcyBpcyBhIG1vY2sgY2lwaGVydGV4dCB0aGF0IGRvY3VtZW50cyBhIGNvcnJlY3RseSBmb3JtYXR0ZWQgU3RlbGxhciBtYWlsIGVudmVsb3BlLg==",
  },
  "release-notes.txt": `Stealth Mail Client v1.2.0 Release Notes
=======================================

We are excited to release v1.2.0 of the Stealth cryptographic mail client.

Key Features & Updates:
- Progressive-disclosure provenance panel: inspect transaction hashes, signatures, commitments, and relay node records.
- Adaptive Ambient Backdrops: beautiful glow rings and backdrops that react to the sender's avatar gradient.
- Smart Calendar Invites: click calendar cards in emails to automatically schedule meetings on your local timeline.
- Enhanced Inbox Controls: whitelist, quarantine, or block senders based on automated postage policies.

Security Updates:
- Encrypted attachments now use sandboxed sandboxing for previews.
- Verified Stellar identities receive a green badge check mark.
- Standard bridge warnings are shown for legacy non-Stellar messages.`,

  "public-key.txt": `-----BEGIN STEALTH PUBLIC KEY BLOCK-----
Version: Stealth Mail v1.2

mQINBGNW0oIBEAC+w71tK6cI5Q5rU3+D/eCpx1RUpvWb2v1w04yE3D481w2m7w9E
U2VjdXJlIGlkZW50aXR5IGZvciB1c2VyIGV2ZUBzdGVhbHRoLnh5ei4gUGxlYXNl
dXNlIHRoaXMgcHVibGljIGtleSB0byBlbmNyeXB0IGFsbCBkaXJlY3QgbWFpbHMu
-----END STEALTH PUBLIC KEY BLOCK-----`,

  "encrypted-data.pgp": `-----BEGIN PGP MESSAGE-----
Version: GnuPG v2

hQEMA5/z7xM734rHAQf/c5p3M9y8Pz9kL2x0b2R3gH7+9m2z3v8v7r9w8v7r9v34
N3NlY3VyZSBtZXNzYWdlIGVuY3J5cHRlZCBmb3Igc2VuZGVyIGFuZCByZWNpcGll
bnQgdXNpbmcgQ3VydmUyNTUxOS4gVGhpcyBpcyBhIHF1YXJhbnRpbmVkIHBheWxv
YWQu
-----END PGP MESSAGE-----`,

  "stealth-payload.bin": `53 74 65 61 6c 74 68 20 45 6e 63 72 79 70 74 65 64 20 50 61 79 6c 6f 61 64 0a 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 a1 b2 c3 d4 e5 f6`,
};

export type Attachment = {
  name: string;
  size: string;
  type: string;
};

interface AttachmentPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
  senderAddress?: string;
}

export function AttachmentPreviewDrawer({
  isOpen,
  onClose,
  attachment,
  senderAddress,
}: AttachmentPreviewDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset local state when attachment changes
  useEffect(() => {
    setCopied(false);
    setZoom(1);
    setRotation(0);
    setPdfPage(1);
    setSearchQuery("");
  }, [attachment?.name]);

  if (!attachment) return null;

  const type = attachment.type.toLowerCase();
  const isPDF = type === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(type);
  const isJSON = type === "json";
  const isText = ["txt", "log", "md", "conf"].includes(type);
  const isEncrypted =
    ["enc", "pgp", "gpg", "bin", "payload"].includes(type) ||
    attachment.name.endsWith(".enc") ||
    attachment.name.endsWith(".gpg");
  const isUnsupported = !isPDF && !isImage && !isJSON && !isText && !isEncrypted;

  // Retrieve mock file content
  const getMockContent = (): string | { [key: string]: any } => {
    if (MOCK_FILE_CONTENTS[attachment.name]) {
      return MOCK_FILE_CONTENTS[attachment.name];
    }
    // Fallbacks if not predefined
    if (isJSON) {
      return {
        filename: attachment.name,
        size: attachment.size,
        type: "JSON Document",
        status: "Mock Content Generated",
        timestamp: new Date().toISOString(),
      };
    }
    if (isText) {
      return `This is a mock text viewer for file: ${attachment.name}\nSize: ${attachment.size}\nGenerated preview content for testing.`;
    }
    if (isEncrypted) {
      return `-----BEGIN MOCK ENCRYPTED PAYLOAD-----\nFileName: ${attachment.name}\nSize: ${attachment.size}\nCiphertext: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nPayload hash verified on-chain.\n-----END MOCK ENCRYPTED PAYLOAD-----`;
    }
    return "";
  };

  const activeContent = getMockContent();

  const getMockFileString = (): string => {
    if (typeof activeContent === "string") {
      return activeContent;
    }
    return JSON.stringify(activeContent, null, 2);
  };

  const handleCopy = async () => {
    const text = getMockFileString();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMimeType = (ext: string) => {
    if (ext === "json") return "application/json";
    if (ext === "pdf") return "application/pdf";
    if (ext === "txt") return "text/plain";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    return "application/octet-stream";
  };

  const handleDownload = () => {
    if (isImage) {
      const link = document.createElement("a");
      // Use locally copied image or fall back to base image path
      link.href = `/${attachment.name}`;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const text = getMockFileString();
      const blob = new Blob([text], { type: getMimeType(type) });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Icon switcher for header
  const getHeaderIcon = () => {
    if (isPDF) return <FileText className="h-5 w-5 text-red-300 animate-pulse" />;
    if (isImage) return <ImageIcon className="h-5 w-5 text-violet-300" />;
    if (isJSON) return <Braces className="h-5 w-5 text-emerald-300" />;
    if (isText) return <FileCode className="h-5 w-5 text-sky-200" />;
    if (isEncrypted) return <Lock className="h-5 w-5 text-amber-300" />;
    return <File className="h-5 w-5 text-slate-300" />;
  };

  // Helper for JSON syntax highlighting
  const renderHighlightedJson = (jsonStr: string) => {
    const regex =
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    const parts = jsonStr.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('"') && part.endsWith(":")) {
        return (
          <span key={i} className="text-sky-300">
            {part}
          </span>
        );
      } else if (part.startsWith('"')) {
        return (
          <span key={i} className="text-emerald-300">
            {part}
          </span>
        );
      } else if (/^(true|false)$/.test(part)) {
        return (
          <span key={i} className="text-amber-300 font-semibold">
            {part}
          </span>
        );
      } else if (part === "null") {
        return (
          <span key={i} className="text-gray-400 italic">
            {part}
          </span>
        );
      } else if (/^-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(part)) {
        return (
          <span key={i} className="text-violet-300">
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-white/80">
          {part}
        </span>
      );
    });
  };

  // Helper for safe text line numbers
  const renderTextWithLines = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="flex font-mono text-[13px] leading-6 select-text">
        <div className="w-10 text-right select-none text-muted-foreground/45 border-r border-white/5 pr-2.5 mr-3 font-semibold tabular-nums">
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto whitespace-pre text-foreground/90">
          {lines.map((line, idx) => (
            <div key={idx}>{line || " "}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-2xl md:max-w-3xl w-full h-full p-0 flex flex-col border-l border-white/10 bg-black/85 backdrop-blur-xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]">
              {getHeaderIcon()}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-[15px] font-semibold text-foreground/95">
                {attachment.name}
              </SheetTitle>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 font-medium">
                <span>{attachment.size}</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="uppercase">{attachment.type} attachment</span>
              </div>
            </div>
          </div>

          {/* Action buttons (Copy / Download) */}
          <div className="flex items-center gap-2 pr-8">
            {(isJSON || isText || isEncrypted) && (
              <button
                onClick={handleCopy}
                title="Copy contents"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition duration-150"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleDownload}
              title="Download file"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-foreground px-3 py-2 text-xs font-semibold text-background hover:opacity-90 transition duration-150"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Preview Viewport */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-black/25 flex flex-col">
          {/* PDF MOCK PREVIEW */}
          {isPDF && (
            <div className="flex-1 flex flex-col h-full">
              {/* PDF Toolbar */}
              <div className="flex items-center justify-between px-6 py-2 bg-white/[0.02] border-b border-white/5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground transition"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground transition"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground transition ml-1"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={pdfPage <= 1}
                    onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-medium">
                    Page {pdfPage} of {(activeContent as any).pages?.length || 3}
                  </span>
                  <button
                    disabled={pdfPage >= ((activeContent as any).pages?.length || 3)}
                    onClick={() =>
                      setPdfPage((p) => Math.min((activeContent as any).pages?.length || 3, p + 1))
                    }
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative flex items-center bg-white/[0.04] rounded px-2 py-1 border border-white/5 max-w-[150px]">
                  <Search className="h-3.5 w-3.5 mr-1.5 opacity-60" />
                  <input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-full text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* PDF Document Canvas */}
              <div className="flex-1 p-6 overflow-y-auto flex justify-center items-start bg-[#141416]">
                <div
                  className="bg-white text-zinc-900 rounded shadow-2xl p-8 max-w-[650px] w-full min-h-[750px] flex flex-col transition-all duration-300 origin-top"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <div className="flex justify-between items-center border-b border-zinc-200 pb-3 mb-6">
                    <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                      {(activeContent as any).title}
                    </span>
                    <span className="text-[10px] text-zinc-400">Page {pdfPage}</span>
                  </div>

                  {(() => {
                    const pages = (activeContent as any).pages || [];
                    const currentPage = pages.find((p: any) => p.pageNumber === pdfPage);
                    if (!currentPage) return null;

                    return (
                      <div className="flex-1 flex flex-col">
                        <h1 className="text-xl font-bold text-zinc-800 mb-4 tracking-tight">
                          {currentPage.title}
                        </h1>
                        <div className="text-sm text-zinc-600 leading-6 space-y-4 whitespace-pre-wrap select-text">
                          {currentPage.content}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="border-t border-zinc-100 pt-3 mt-6 flex justify-between items-center text-[10px] text-zinc-400">
                    <span>STEALTH SECURE READ BY {senderAddress || "EVE NAVARRO"}</span>
                    <span>CONFIDENTIAL</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IMAGE PREVIEW */}
          {isImage && (
            <div className="flex-1 flex flex-col h-full bg-[#18181b]">
              {/* Image Toolbar */}
              <div className="flex items-center justify-between px-6 py-2 bg-white/[0.02] border-b border-white/5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground transition"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                    className="p-1 hover:bg-white/[0.05] rounded text-foreground transition"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                    }}
                    className="px-2 py-0.5 hover:bg-white/[0.05] rounded text-foreground transition text-[10px]"
                  >
                    Reset
                  </button>
                </div>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:bg-white/[0.05] rounded text-foreground transition flex items-center gap-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Rotate</span>
                </button>
              </div>

              {/* Image Viewport with checkerboard background */}
              <div
                className="flex-1 overflow-auto p-8 flex items-center justify-center relative min-h-[450px]"
                style={{
                  backgroundImage: `linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
                                    linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%),
                                    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.03) 75%)`,
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
                }}
              >
                <img
                  src={`/${attachment.name}`}
                  alt={attachment.name}
                  className="max-h-[70vh] rounded shadow-2xl transition-all duration-300 origin-center select-none pointer-events-none object-contain"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                  onError={(e) => {
                    // Fallback to moodboard image if path mismatch
                    (e.target as HTMLImageElement).src = "/brand-moodboard.png";
                  }}
                />
              </div>
            </div>
          )}

          {/* JSON PREVIEW */}
          {isJSON && (
            <div className="p-6">
              <div className="rounded-xl border border-white/10 bg-black/45 p-5 shadow-inner">
                <pre className="font-mono text-[13px] leading-6 select-text overflow-x-auto whitespace-pre">
                  {renderHighlightedJson(JSON.stringify(activeContent, null, 2))}
                </pre>
              </div>
            </div>
          )}

          {/* TEXT PREVIEW */}
          {isText && (
            <div className="p-6">
              <div className="rounded-xl border border-white/10 bg-black/45 p-5 shadow-inner">
                {renderTextWithLines(getMockFileString())}
              </div>
            </div>
          )}

          {/* ENCRYPTED PAYLOAD PREVIEW */}
          {isEncrypted && (
            <div className="p-6 space-y-5">
              {/* Security Header Card */}
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 flex gap-3.5">
                <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-amber-500/10 text-amber-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground/95">
                    Encrypted Ciphertext Payload
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[550px]">
                    This file contains cryptographically encrypted payload data. Previews are
                    restricted to headers and raw hexadecimal structure to prevent data exposure.
                  </p>
                </div>
              </div>

              {/* Cryptographic Metadata */}
              <div className="rounded-xl border border-white/5 bg-white/[0.015] p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                    Encryption Standard
                  </div>
                  <div className="text-xs font-semibold font-mono text-foreground/80">
                    Curve25519-XSalsa20-Poly1305
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                    On-Chain Commitment
                  </div>
                  <div className="text-xs font-semibold font-mono text-foreground/80 truncate">
                    Soroban read_proof (ledger #52891244)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                    Quarantine Status
                  </div>
                  <div className="text-xs font-semibold text-amber-300 font-medium">
                    Restricted (Payload quarantined)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                    Integrity Signature
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Verified Stellar Signature
                  </div>
                </div>
              </div>

              {/* Raw Ciphertext Dump */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/70">
                    Raw Ciphertext Inspector
                  </span>
                  <span className="font-mono text-[10px]">
                    16-byte blocks (ASCII representation)
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/45 p-5 shadow-inner">
                  <pre className="font-mono text-[12.5px] leading-6 select-text overflow-x-auto text-amber-200/90 whitespace-pre">
                    {`00000000  53 74 65 61 6c 74 68 20  45 6e 63 72 79 70 74 65  |Stealth Encrypte|
00000010  64 20 50 61 79 6c 6f 61  64 0a 01 02 03 04 05 06  |d Payload.......|
00000020  07 08 09 0a 0b 0c 0d 0e  0f 10 11 12 13 14 15 16  |................|
00000030  17 18 19 1a 1b 1c 1d 1e  1f 20 a1 b2 c3 d4 e5 f6  |......... ......|`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* UNSUPPORTED FALLBACK */}
          {isUnsupported && (
            <div className="p-8 flex-1 flex flex-col justify-center items-center text-center max-w-[420px] mx-auto">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-inner text-muted-foreground">
                <File className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground/95">Preview Unavailable</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                This file extension{" "}
                <span className="font-semibold text-foreground font-mono">.{type}</span> is not
                supported for interactive, sandboxed previews in Stealth.
              </p>

              <div className="w-full mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left space-y-3">
                <div className="flex justify-between border-b border-white/5 pb-2 text-xs">
                  <span className="text-muted-foreground">File name</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {attachment.name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2 text-xs">
                  <span className="text-muted-foreground">File size</span>
                  <span className="font-semibold text-foreground">{attachment.size}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">MIME classification</span>
                  <span className="font-semibold font-mono text-foreground">
                    {getMimeType(type)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-xs font-semibold text-background hover:opacity-90 transition"
              >
                <Download className="h-4 w-4" /> Download file locally
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
