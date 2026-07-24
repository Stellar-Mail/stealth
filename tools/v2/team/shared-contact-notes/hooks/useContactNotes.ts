import { useReducer, useCallback, useEffect, useRef } from "react";
import { NoteService } from "../service";
import type { Note, CreateNoteInput, UpdateNoteInput, ContactId } from "../types";
import type { NoteError } from "../errors";

type NotesState = {
  status: "idle" | "loading" | "success" | "error";
  notes: Note[];
  error: NoteError | null;
};

type NotesAction =
  | { type: "LOADING" }
  | { type: "SUCCESS"; notes: Note[] }
  | { type: "ERROR"; error: NoteError }
  | { type: "ADD_NOTE"; note: Note }
  | { type: "UPDATE_NOTE"; note: Note }
  | { type: "REMOVE_NOTE"; id: string }
  | { type: "ARCHIVE_NOTE"; note: Note };

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: "loading", error: null };
    case "SUCCESS":
      return { status: "success", notes: action.notes, error: null };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "ADD_NOTE":
      return { ...state, notes: [...state.notes, action.note] };
    case "UPDATE_NOTE":
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.note.id ? action.note : n)),
      };
    case "REMOVE_NOTE":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "ARCHIVE_NOTE":
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.note.id ? action.note : n)),
      };
    default:
      return state;
  }
}

const initialState: NotesState = {
  status: "idle",
  notes: [],
  error: null,
};

export function useContactNotes(contactId: ContactId, service: NoteService, initialLoad = true) {
  const [state, dispatch] = useReducer(notesReducer, initialState);
  const mountedRef = useRef(true);

  const loadNotes = useCallback(async () => {
    dispatch({ type: "LOADING" });
    try {
      const notes = await service.getByContact(contactId);
      if (mountedRef.current) {
        dispatch({ type: "SUCCESS", notes });
      }
    } catch (error) {
      if (mountedRef.current) {
        dispatch({ type: "ERROR", error: error as NoteError });
      }
    }
  }, [contactId, service]);

  useEffect(() => {
    mountedRef.current = true;
    if (initialLoad) {
      loadNotes();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [loadNotes, initialLoad]);

  const createNote = useCallback(
    async (input: Omit<CreateNoteInput, "contactId">) => {
      const note = await service.create({ ...input, contactId });
      if (mountedRef.current) {
        dispatch({ type: "ADD_NOTE", note });
      }
      return note;
    },
    [contactId, service],
  );

  const updateNote = useCallback(
    async (id: string, input: UpdateNoteInput) => {
      const note = await service.update(id, input);
      if (mountedRef.current) {
        dispatch({ type: "UPDATE_NOTE", note });
      }
      return note;
    },
    [service],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await service.delete(id);
      if (mountedRef.current) {
        dispatch({ type: "REMOVE_NOTE", id });
      }
    },
    [service],
  );

  const archiveNote = useCallback(
    async (id: string) => {
      const note = await service.archive(id);
      if (mountedRef.current) {
        dispatch({ type: "ARCHIVE_NOTE", note });
      }
      return note;
    },
    [service],
  );

  return {
    ...state,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    archiveNote,
  };
}
