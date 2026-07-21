# Review Notes — Mail-to-Ticket Converter

## Validated Behavior

- Service factory accepts optional `simulateDelay`, `delayMs`, `failureRate` config for testing
- `getEmails`, `getTickets`, `getTeamMembers`, `getMetrics` load from local JSON fixtures with no live network calls
- `convertEmailToTicket` removes the converted email from the email list
- `updateTicketStatus` advances status and updates `updatedAt` timestamp
- `assignTicket` validates that the team member exists before assigning
- `computeMetrics` handles empty arrays and partial data correctly
- React hook uses `useReducer` with discriminated union actions and abort ref pattern
- All four FetchState states (loading, empty, error, success) are handled in every data-consuming component
- `FetchStateHandler` utility component DRY's up the state switching pattern
- Components use Tailwind v4 dark-theme tokens from the global design system
- No secrets, tokens, or live service URLs are present in code or fixtures

## Known Limitations

Not yet implemented / out of scope for V2:

- No integration with main mail app inbox or routing
- No database persistence — data is ephemeral (in-memory)
- No real SMTP/IMAP fetching — all data is fixture-based
- No authentication or authorization checks
- No notification system when tickets are assigned
- No attachment handling beyond the boolean flag
- No search or filter functionality
- No pagination for large email/ticket lists
- No undo operation for ticket creation
- No WebSocket or real-time updates

## Future Integration Considerations

When connecting to the main app, the following would need to be added:

- Import real emails from the app's mail store instead of fixtures
- Save tickets to the app's database
- Route ticket notifications through the app's notification system
- Add user authentication to identify who created the ticket
- Add permission checks for assignment and status changes
