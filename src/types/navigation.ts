
// 1. The Interface (The shape of your state)
export interface MailNavigationState {
  isDrawerOpen: boolean;
  currentView: 'list' | 'reader' | 'compose';
  selectedFolder: string | null;
  selectedMessageId: string | null;
}

// 2. The Initial State (Prevents writing these defaults multiple times)
export const initialNavigationState: MailNavigationState = {
  isDrawerOpen: true, // often true on desktop, false on mobile
  currentView: 'list',
  selectedFolder: 'inbox', 
  selectedMessageId: null,
};

// ------------------------------------------------------------------
// IF USING REACT CONTEXT & useReducer (Standard React)
// ------------------------------------------------------------------

// 3. Define the Actions (What can happen in the UI)
export type MailNavigationAction =
  | { type: 'TOGGLE_DRAWER'; payload?: boolean }
  | { type: 'SET_VIEW'; payload: MailNavigationState['currentView'] }
  | { type: 'SELECT_FOLDER'; payload: string }
  | { type: 'SELECT_MESSAGE'; payload: string | null };

// 4. The Reducer (How the state changes when an action happens)
export function navigationReducer(
  state: MailNavigationState,
  action: MailNavigationAction
): MailNavigationState {
  switch (action.type) {
    case 'TOGGLE_DRAWER':
      return { 
        ...state, 
        isDrawerOpen: action.payload !== undefined ? action.payload : !state.isDrawerOpen 
      };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SELECT_FOLDER':
      return { 
        ...state, 
        selectedFolder: action.payload,
        currentView: 'list', // Reset to list view when changing folders
        selectedMessageId: null 
      };
    case 'SELECT_MESSAGE':
      return { 
        ...state, 
        selectedMessageId: action.payload,
        currentView: action.payload ? 'reader' : 'list' // Auto-switch view
      };
    default:
      return state;
  }
}
