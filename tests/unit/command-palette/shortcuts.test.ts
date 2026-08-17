// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getShortcutAction, isEditableTarget } from "../../../src/features/command-palette";

function editableTarget(tagName: string, parentElement: any = null) {
  return {
    tagName,
    isContentEditable: false,
    getAttribute: () => null,
    parentElement,
  };
}

describe("shortcut guards", () => {
  it("treats inputs, textareas, selects, and textboxes as editable", () => {
    expect(isEditableTarget(editableTarget("INPUT") as any)).toBe(true);
    expect(isEditableTarget(editableTarget("TEXTAREA") as any)).toBe(true);
    expect(isEditableTarget(editableTarget("SELECT") as any)).toBe(true);
    expect(
      isEditableTarget({
        tagName: "DIV",
        isContentEditable: false,
        getAttribute: (name: string) => (name === "role" ? "textbox" : null),
        parentElement: null,
      } as any),
    ).toBe(true);
  });

  it("walks up parent elements to find editable ancestors", () => {
    const parent = editableTarget("TEXTAREA");
    const child = editableTarget("SPAN", parent);
    expect(isEditableTarget(child as any)).toBe(true);
  });

  it("suppresses shortcuts while typing in editable fields", () => {
    expect(
      getShortcutAction({
        key: "k",
        ctrlKey: true,
        target: editableTarget("INPUT") as any,
      }),
    ).toBeNull();
    expect(
      getShortcutAction({
        key: "?",
        shiftKey: true,
        target: editableTarget("TEXTAREA") as any,
      }),
    ).toBeNull();
  });

  it("maps supported global shortcuts outside editable fields", () => {
    expect(getShortcutAction({ key: "k", ctrlKey: true, target: null })).toBe("open-palette");
    expect(getShortcutAction({ key: "n", metaKey: true, target: null })).toBe("compose");
    expect(getShortcutAction({ key: "?", shiftKey: true, target: null })).toBe("open-shortcuts");
    expect(getShortcutAction({ key: ",", target: null })).toBe("open-settings");
  });

  it("suppresses global shortcuts when a dialog is open in the DOM, except for open-palette", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    try {
      expect(getShortcutAction({ key: "k", ctrlKey: true, target: null })).toBe("open-palette");
      expect(getShortcutAction({ key: "n", metaKey: true, target: null })).toBeNull();
      expect(getShortcutAction({ key: "?", shiftKey: true, target: null })).toBeNull();
      expect(getShortcutAction({ key: ",", target: null })).toBeNull();
    } finally {
      document.body.removeChild(dialog);
    }
  });
});
