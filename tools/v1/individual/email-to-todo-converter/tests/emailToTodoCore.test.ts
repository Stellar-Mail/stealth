import { describe, expect, it } from "vitest";
import { convertEmailToTodos, type EmailToTodoInput } from "../services/emailToTodoCore";

function email(overrides: Partial<EmailToTodoInput> = {}): EmailToTodoInput {
  return {
    id: "email-direct-request",
    subject: "Please review the invoice by Friday",
    sender: "billing@example.com",
    receivedAt: "2026-06-19T09:00:00Z",
    bodyText: "Please review the attached invoice by Friday and let me know if anything is missing.",
    labels: ["inbox"],
    ...overrides,
  };
}

describe("convertEmailToTodos", () => {
  it("extracts a deterministic task from a direct request subject", () => {
    const first = convertEmailToTodos(email());
    const second = convertEmailToTodos(email());

    expect(first).toEqual(second);
    expect(first.status).toBe("success");
    expect(first.tasks).toHaveLength(1);
    expect(first.tasks[0]).toMatchObject({
      id: "todo-email-direct-request-1",
      title: "Review the invoice",
      dueDate: "2026-06-26",
      priority: "normal",
      completed: false,
      source: {
        emailId: "email-direct-request",
        subject: "Please review the invoice by Friday",
        sender: "billing@example.com",
        receivedAt: "2026-06-19T09:00:00Z",
      },
    });
  });

  it("prefers a direct action sentence from the body when it carries more detail", () => {
    const result = convertEmailToTodos(
      email({
        id: "email-urgent-follow-up",
        subject: "Urgent: follow up with partner",
        sender: "ops@example.com",
        receivedAt: "2026-06-19T10:30:00Z",
        bodyText: "Can you follow up with the partner today? This is blocking the launch checklist.",
        labels: ["important"],
      }),
    );

    expect(result.status).toBe("success");
    expect(result.tasks[0]).toMatchObject({
      id: "todo-email-urgent-follow-up-1",
      title: "Follow up with the partner",
      dueDate: "2026-06-19",
      priority: "high",
    });
  });

  it("returns an empty state when no clear action is detected", () => {
    const result = convertEmailToTodos(
      email({
        id: "email-newsletter",
        subject: "Weekly product updates",
        sender: "newsletter@example.com",
        receivedAt: "2026-06-19T11:00:00Z",
        bodyText: "Here are this week's product updates and release notes.",
        labels: ["newsletter"],
      }),
    );

    expect(result).toMatchObject({
      status: "empty",
      tasks: [],
      message: "No clear action item was detected in this email.",
    });
  });

  it("returns validation errors instead of creating a blank task", () => {
    const result = convertEmailToTodos(
      email({
        id: " ",
        subject: " ",
        sender: " ",
        receivedAt: "not-a-date",
        bodyText: " ",
      }),
    );

    expect(result.status).toBe("error");
    expect(result.tasks).toEqual([]);
    expect(result.errors).toEqual([
      "Email id is required.",
      "Sender is required.",
      "receivedAt must be a valid ISO-8601 timestamp.",
      "Subject or bodyText is required.",
    ]);
  });
});
