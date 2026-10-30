# Mail Tools Rail

The 44px rail sits at the far-right edge, below the account avatar. Its panels open inward without replacing the conversation or resizing its toolbar. Close a panel with its close button or Escape; the bottom chevron collapses the rail.

- Calendar opens the existing planner or a selected event.
- People reads saved contacts for authenticated accounts and mailbox senders in demo mode. Selecting a person opens Compose with the recipient filled in. Import uses the existing contact importer.
- Files lists attachments from loaded, non-trash/non-spam mail and opens their source message. It does not bypass attachment verification.
- Saved mail uses existing stars; Follow-ups uses the snooze/reminder flow; Proofs opens the existing inspector and lists loaded pending mail. None fabricates proof or delivery status.
- Each tool has a bundled two-tone SVG illustration in `ToolIcon.tsx`, including the Work-only tools. There are no remote icon requests.
- Work adds linked tasks and private conversation notes. Both reuse the Work session owned by `MailApp`; they are preview-only, actor-isolated, and reset on reload. Neither is sent to message recipients or advertised as server-synced.

Only implemented tools are shown. V2 tools remain unlinked. Styling is scoped to this folder and uses the existing dark/light theme tokens.
