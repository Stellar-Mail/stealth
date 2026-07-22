import { protocolManifest } from "./protocol";

// Issue #1522: expose a safe, read-only build + protocol version descriptor.
// Values are sourced from immutable build configuration and the protocol
// manifest only — never from request input — and must never include secrets
// or source paths.
export interface VersionInfo {
  build: string;
  apiVersion: string;
  supportedVersions: readonly string[];
}

// A non-secret build identifier injected at build time. Falls back to a stable
// development placeholder so the field is always present and never leaks paths.
function readBuildId(): string {
  const injected =
    typeof import.meta.env?.VITE_BUILD_ID === "string" ? import.meta.env.VITE_BUILD_ID.trim() : "";
  return injected || "development";
}

export function getVersionInfo(): VersionInfo {
  return {
    build: readBuildId(),
    apiVersion: protocolManifest.apiVersion,
    supportedVersions: protocolManifest.supportedVersions,
  };
}
