import { describe, expect, it } from "vitest";
import {
  MessageEditor,
  validateMessage,
  parseRecipientsInput,
  formatRecipientsDisplay,
  formatMessagePreview,
} from "../components/MessageEditor";

describe("MessageEditor module", () => {
  it("exports the MessageEditor component", () => {
    expect(MessageEditor).toBeDefined();
    expect(typeof MessageEditor).toBe("function");
  });

  it("exports validateMessage helper", () => {
    expect(validateMessage).toBeDefined();
    expect(typeof validateMessage).toBe("function");
  });

  it("exports parseRecipientsInput helper", () => {
    expect(parseRecipientsInput).toBeDefined();
    expect(typeof parseRecipientsInput).toBe("function");
  });

  it("exports formatRecipientsDisplay helper", () => {
    expect(formatRecipientsDisplay).toBeDefined();
    expect(typeof formatRecipientsDisplay).toBe("function");
  });

  it("exports formatMessagePreview helper", () => {
    expect(formatMessagePreview).toBeDefined();
    expect(typeof formatMessagePreview).toBe("function");
  });
});
