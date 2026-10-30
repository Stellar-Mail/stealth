// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { WorkWorkspace } from "@/features/work/WorkWorkspace";
import {
  canPreviewWork,
  useWorkSession,
  type WorkSession,
  type WorkView,
} from "@/features/work/model";
import { emails } from "@/components/mail/data";

afterEach(cleanup);
function Harness({ view = "tasks" }: { view?: WorkView }) {
  const [session, update] = useState<WorkSession>({ tasks: [], notes: {} });
  return (
    <WorkWorkspace
      view={view}
      emails={emails}
      events={[]}
      session={session}
      update={update}
      previewAllowed
      onSelect={vi.fn()}
      onOpenEmail={vi.fn()}
      onOpenCalendar={vi.fn()}
      onExit={vi.fn()}
    />
  );
}
describe("Work workspace", () => {
  it("allows developer/demo preview but does not invent production paid access", () => {
    expect(canPreviewWork(true, false)).toBe(true);
    expect(canPreviewWork(false, true)).toBe(true);
    expect(canPreviewWork(false, false)).toBe(false);
    render(
      <WorkWorkspace
        view="tasks"
        emails={emails}
        events={[]}
        session={{ tasks: [], notes: {} }}
        update={vi.fn()}
        previewAllowed={false}
        onSelect={vi.fn()}
        onOpenEmail={vi.fn()}
        onOpenCalendar={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(screen.queryByRole("textbox", { name: "Task title" })).toBeNull();
    expect(screen.getByText("Work is in preview")).not.toBeNull();
  });
  it("adds, completes and deletes real session tasks", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
      target: { value: "Review the proposal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    const complete = screen.getByRole("checkbox", { name: "Complete Review the proposal" });
    fireEvent.click(complete);
    expect((complete as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Review the proposal" }));
    expect(screen.queryByText("Review the proposal")).toBeNull();
  });
  it("uses an empty, controlled V1 notes tool with no fabricated discussion or simulator", () => {
    render(<Harness view="notes" />);
    expect(screen.queryByText("Sarah Jenkins")).toBeNull();
    expect(screen.queryByRole("group", { name: "Demo State Controller" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Add a private note" }), {
      target: { value: "Keep this note private" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByText("Keep this note private")).not.toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Notes conversation" }), {
      target: { value: emails[1].id },
    });
    expect(screen.queryByText("Keep this note private")).toBeNull();
  });
  it("does not expose Work session data after switching accounts", () => {
    const { result, rerender } = renderHook(({ owner }) => useWorkSession(owner), {
      initialProps: { owner: "alice" },
    });
    act(() =>
      result.current.update((session) => ({
        ...session,
        tasks: [{ id: "private", title: "Alice's task", done: false }],
      })),
    );
    expect(result.current.session.tasks).toHaveLength(1);
    rerender({ owner: "bob" });
    expect(result.current.session.tasks).toEqual([]);
    expect(result.current.session.notes).toEqual({});
  });
});
