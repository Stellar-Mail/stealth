import type { FeedbackDiagnostics } from "@/server/api/domain";
import { LATEST_SUPPORT_ID_STORAGE_KEY } from "@/lib/api/client";

const KNOWN_FEATURE_FLAGS = new Set([
  "desktop-notifications",
  "live-mailbox",
  "operator-feedback",
  "testnet-postage",
  "verification-delivery",
]);

function browserFamily(userAgent: string): string {
  const candidates: Array<[RegExp, string]> = [
    [/Edg\/(\d+)/, "Edge"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/Version\/(\d+).+Safari\//, "Safari"],
  ];
  for (const [pattern, name] of candidates) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return "Other";
}

function operatingSystem(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Other";
}

/** Returns only browser family/major and OS; the raw user-agent is never retained. */
export function summarizeBrowser(userAgent: string): string {
  return `${browserFamily(userAgent)} / ${operatingSystem(userAgent)}`;
}

export function currentSafeRoute(locationValue: Pick<Location, "pathname">): string {
  const pathname = locationValue.pathname || "/";
  return pathname
    .split("/")
    .map((segment) => {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)) return ":id";
      if (/^[GS][A-Z2-7]{55}$/.test(segment)) return ":address";
      if (/^[0-9a-f]{24,}$/i.test(segment) || segment.length > 40) return ":id";
      return segment;
    })
    .join("/")
    .slice(0, 160);
}

export function configuredFeatureFlags(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((flag) => flag.trim())
        .filter((flag) => KNOWN_FEATURE_FLAGS.has(flag)),
    ),
  ).sort();
}

function latestSupportId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(LATEST_SUPPORT_ID_STORAGE_KEY);
    return value && /^sup_[a-f0-9]{8,12}$/i.test(value) ? value.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function readServiceStatus(): Promise<FeedbackDiagnostics["serviceStatus"]> {
  try {
    const response = await fetch("/api/v1/health", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const body = (await response.json()) as { data?: { status?: unknown; ready?: unknown } };
    if (
      ["ok", "ready", "healthy"].includes(String(body.data?.status)) &&
      body.data?.ready !== false
    ) {
      return "healthy";
    }
    if (
      ["degraded", "not_ready"].includes(String(body.data?.status)) ||
      body.data?.ready === false
    ) {
      return "degraded";
    }
    if (!response.ok) return "unavailable";
    return "unknown";
  } catch {
    return "unavailable";
  }
}

export async function collectFeedbackDiagnostics(): Promise<FeedbackDiagnostics> {
  const appVersion =
    import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_COMMIT_SHA || "development";
  return {
    appVersion: String(appVersion).slice(0, 80),
    browser: summarizeBrowser(navigator.userAgent),
    route: currentSafeRoute(window.location),
    featureFlags: configuredFeatureFlags(import.meta.env.VITE_FEATURE_FLAGS),
    supportId: latestSupportId(),
    serviceStatus: await readServiceStatus(),
  };
}

export interface PreparedFeedbackScreenshot {
  dataUrl: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read screenshot"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Re-encodes pixels through canvas so file names and EXIF metadata are discarded. */
export async function prepareFeedbackScreenshot(file: File): Promise<PreparedFeedbackScreenshot> {
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP screenshot");
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot safely remove screenshot metadata");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser cannot safely process the screenshot");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const mediaType: PreparedFeedbackScreenshot["mediaType"] = "image/webp";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mediaType, 0.82));
  if (!blob || blob.type !== mediaType) {
    throw new Error("This browser cannot safely re-encode the screenshot");
  }
  if (blob.size > 1024 * 1024) {
    throw new Error("Screenshot is larger than 1 MiB after privacy processing");
  }
  return { dataUrl: await blobToDataUrl(blob), mediaType, sizeBytes: blob.size };
}
