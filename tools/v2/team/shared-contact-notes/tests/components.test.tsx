// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { SharedContactNotes } from "../components/SharedContactNotes";
import { NoteService } from "../service";
import { seedNotes } from "../fixtures/notes";
import type { Note } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createTestService(notes?: Note[]) {
  return new NoteService(notes, { delayMs: 0 });
}

describe("SharedContactNotes", () => {
  it("renders the component with heading", () => {
    const service = createTestService();
    render(<SharedContactNotes contactId="contact-alice" service={service} />);
    expect(screen.getByText("Shared Contact Notes")).toBeDefined();
  });

  it("shows loading state initially", () => {
    const service = createTestService();
    render(<SharedContactNotes contactId="contact-alice" service={service} />);
    expect(screen.getByLabelText("Loading contact notes")).toBeDefined();
  });

  it("displays notes after loading", async () => {
    const service = createTestService(seedNotes);
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    });

    expect(screen.getByText(/Follow up on Q2/)).toBeDefined();
  });

  it("shows empty state when contact has no notes", async () => {
    const service = createTestService();
    render(<SharedContactNotes contactId="contact-unknown" service={service} />);

    await waitFor(() => {
      expect(screen.getByText("No shared notes")).toBeDefined();
    });
  });

  it("shows error state when service throws", async () => {
    const service = createTestService(seedNotes);
    vi.spyOn(service, "getByContact").mockRejectedValue(new Error("Network error"));

    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load contact notes")).toBeDefined();
    });
  });

  it("opens the note form when Add Note is clicked", async () => {
    const service = createTestService(seedNotes);
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    });

    const addButton = screen.getByLabelText("Add a new note");
    fireEvent.click(addButton);

    expect(screen.getByLabelText("Add or edit note")).toBeDefined();
    expect(screen.getByLabelText("Note")).toBeDefined();
  });

  it("can create a new note through the form", async () => {
    const service = createTestService(seedNotes);
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Add a new note"));

    const textarea = screen.getByLabelText("Note") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "New test note" } });

    fireEvent.click(screen.getByLabelText("Save note"));

    await waitFor(() => {
      expect(screen.getByText("New test note")).toBeDefined();
    });
  });

  it("archives a note when archive button is clicked", async () => {
    const service = createTestService(seedNotes);
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    });

    const archiveButtons = screen.getAllByLabelText("Archive note");
    fireEvent.click(archiveButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Archived").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("deletes a note when delete button is clicked", async () => {
    const service = createTestService(seedNotes);
    render(<SharedContactNotes contactId="contact-alice" service={service} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice prefers email/)).toBeDefined();
    });

    const deleteButtons = screen.getAllByLabelText("Delete note");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      const noteText = screen.queryByText(/Alice prefers email/);
      expect(noteText).toBeNull();
    });
  });
});
