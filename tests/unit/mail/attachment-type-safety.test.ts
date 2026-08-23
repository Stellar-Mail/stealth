import { describe, expect, it } from "vitest";
import { isPreviewableType, isRiskyType } from "@/features/mail/useAttachmentDownload";

describe("isPreviewableType (BETA-067)", () => {
  it("allows safe image types", () => {
    expect(isPreviewableType("png")).toBe(true);
    expect(isPreviewableType("jpg")).toBe(true);
    expect(isPreviewableType("jpeg")).toBe(true);
    expect(isPreviewableType("webp")).toBe(true);
    expect(isPreviewableType("gif")).toBe(true);
  });

  it("allows safe document types", () => {
    expect(isPreviewableType("pdf")).toBe(true);
    expect(isPreviewableType("txt")).toBe(true);
    expect(isPreviewableType("log")).toBe(true);
    expect(isPreviewableType("md")).toBe(true);
    expect(isPreviewableType("csv")).toBe(true);
    expect(isPreviewableType("json")).toBe(true);
    expect(isPreviewableType("xml")).toBe(true);
  });

  it("rejects risky executable types", () => {
    expect(isPreviewableType("exe")).toBe(false);
    expect(isPreviewableType("sh")).toBe(false);
    expect(isPreviewableType("bat")).toBe(false);
    expect(isPreviewableType("js")).toBe(false);
    expect(isPreviewableType("vbs")).toBe(false);
  });

  it("rejects unsupported types", () => {
    expect(isPreviewableType("key")).toBe(false);
    expect(isPreviewableType("zip")).toBe(false);
    expect(isPreviewableType("mp4")).toBe(false);
    expect(isPreviewableType("unknown")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isPreviewableType("PDF")).toBe(true);
    expect(isPreviewableType("PNG")).toBe(true);
    expect(isPreviewableType("Txt")).toBe(true);
  });
});

describe("isRiskyType (BETA-067)", () => {
  it("flags executable extensions as risky", () => {
    expect(isRiskyType("exe")).toBe(true);
    expect(isRiskyType("bat")).toBe(true);
    expect(isRiskyType("cmd")).toBe(true);
    expect(isRiskyType("com")).toBe(true);
    expect(isRiskyType("msi")).toBe(true);
    expect(isRiskyType("scr")).toBe(true);
    expect(isRiskyType("pif")).toBe(true);
  });

  it("flags script types as risky", () => {
    expect(isRiskyType("js")).toBe(true);
    expect(isRiskyType("mjs")).toBe(true);
    expect(isRiskyType("vbs")).toBe(true);
    expect(isRiskyType("vbe")).toBe(true);
    expect(isRiskyType("wsf")).toBe(true);
    expect(isRiskyType("ps1")).toBe(true);
    expect(isRiskyType("sh")).toBe(true);
    expect(isRiskyType("bash")).toBe(true);
  });

  it("flags Office macros as risky", () => {
    expect(isRiskyType("docm")).toBe(true);
    expect(isRiskyType("xlsm")).toBe(true);
    expect(isRiskyType("pptm")).toBe(true);
  });

  it("does not flag safe types as risky", () => {
    expect(isRiskyType("pdf")).toBe(false);
    expect(isRiskyType("png")).toBe(false);
    expect(isRiskyType("txt")).toBe(false);
    expect(isRiskyType("json")).toBe(false);
    expect(isRiskyType("csv")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isRiskyType("EXE")).toBe(true);
    expect(isRiskyType("Js")).toBe(true);
    expect(isRiskyType("SH")).toBe(true);
  });
});
