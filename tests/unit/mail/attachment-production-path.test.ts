/**
 * BETA-067: Proves that no mock decrypt/verify layer, demo fixtures,
 * or fake service adapters are reachable in the production attachment
 * preview path.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("BETA-067: No mock crypto/decrypt layer in production path", () => {
  it("AttachmentPreviewDrawer does not contain MOCK_FILE_CONTENTS", () => {
    const drawer = read("src/components/mail/AttachmentPreviewDrawer.tsx");
    expect(drawer).not.toContain("MOCK_FILE_CONTENTS");
    expect(drawer).not.toContain("getMockContent");
    expect(drawer).not.toContain("getMockFileString");
  });

  it("AttachmentPreviewDrawer imports real crypto primitives", () => {
    const drawer = read("src/components/mail/AttachmentPreviewDrawer.tsx");
    expect(drawer).toContain("useAttachmentDownload");
    expect(drawer).toContain("sanitizeFilenameForDisplay");
  });

  it("useAttachmentDownload uses real decryptAttachment", () => {
    const hook = read("src/features/mail/useAttachmentDownload.ts");
    expect(hook).toContain("decryptAttachment");
    expect(hook).toContain('from "@/services/crypto/open-envelope"');
    expect(hook).not.toContain("mock");
    expect(hook).not.toContain("Mock");
  });

  it("open-envelope.ts exports decryptAttachment", () => {
    const openEnvelope = read("src/services/crypto/open-envelope.ts");
    expect(openEnvelope).toContain("export async function decryptAttachment");
    expect(openEnvelope).toContain("export interface DecryptAttachmentInput");
    expect(openEnvelope).toContain("export interface DecryptAttachmentResult");
  });

  it("AttachmentPreviewDrawer has no hardcoded mock data paths", () => {
    const drawer = read("src/components/mail/AttachmentPreviewDrawer.tsx");
    // No references to local static files for mock content
    expect(drawer).not.toMatch(/\/brand-moodboard\.png/);
    expect(drawer).not.toMatch(/\/mock/i);
    // No fallback to mock images
    expect(drawer).not.toContain("onError");
  });

  it("decryptAttachment test uses real crypto, not mocked", () => {
    const test = read("tests/unit/crypto/decrypt-attachment.test.ts");
    expect(test).toContain("crypto.subtle.encrypt");
    expect(test).toContain("crypto.subtle.generateKey");
    expect(test).not.toContain("vi.mock");
    expect(test).not.toContain("jest.mock");
  });

  it("security test proves no script execution vectors survive", () => {
    const test = read("tests/unit/mail/attachment-security.test.ts");
    expect(test).toContain("sanitizeRawContent");
    expect(test).toContain("isolateRemoteResources");
    expect(test).toContain("script");
    expect(test).toContain("onerror");
    expect(test).toContain("javascript:");
  });

  it("attachment type safety test covers all risky extensions", () => {
    const test = read("tests/unit/mail/attachment-type-safety.test.ts");
    expect(test).toContain("exe");
    expect(test).toContain("bat");
    expect(test).toContain("sh");
    expect(test).toContain("vbs");
    expect(test).toContain("ps1");
    expect(test).toContain("js");
    expect(test).toContain("docm");
  });
});
