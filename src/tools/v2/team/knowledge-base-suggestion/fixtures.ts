export type SuggestionState = "idle" | "loading" | "success" | "error" | "empty";

export interface KnowledgeSuggestion {
  title: string;
  summary: string;
  match: number;
}

export const mockSuggestionStates: SuggestionState[] = [
  "idle",
  "loading",
  "empty",
  "error",
  "success",
];

export const mockSuggestions: KnowledgeSuggestion[] = [
  {
    title: "Configuring Wallet Authentication",
    summary:
      "Learn how to securely configure web3 wallet signatures, challenge issuance, and JWT validation flows for new users.",
    match: 98,
  },
  {
    title: "Troubleshooting Stellar Node Sync Issues",
    summary:
      "Common resolution paths for when the EventIndexer falls behind the active ledger or drops webhook payloads during network congestion.",
    match: 85,
  },
];
