# Test Plan — Mail-to-Ticket Converter

## Automated Tests

Run from repo root:

```bash
node --test tools/v2/team/mail-to-ticket-converter/tests/mail-to-ticket-service.test.mjs
```

### What is covered

| Test                             | Description                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Fixture validation               | Emails, tickets, and team members have all required fields with correct types                                   |
| Email fixture                    | 5 entries with valid dates, required fields, boolean attachment flag                                            |
| Ticket fixture                   | 4 entries covering all statuses (open, in-progress, resolved) and priorities; resolved tickets have resolutions |
| Team member fixture              | 5 members with id, name, email, role                                                                            |
| `computeMetrics` totals          | Correct counts for total, open, in-progress, resolved, closed                                                   |
| `computeMetrics` by priority     | Correct distribution across critical, high, medium, low                                                         |
| `computeMetrics` by category     | Correct distribution across bug, billing, feature-request, support, other                                       |
| `computeMetrics` resolution time | Computes average for resolved tickets; null when none resolved                                                  |
| Edge cases                       | Empty ticket array returns all zeros and null resolution time                                                   |

## Manual Review Checklist

- [ ] All FetchState states render correctly (loading skeleton, error with retry, empty state, success data)
- [ ] Tab navigation switches between Inbox, Tickets, Metrics panels
- [ ] "Convert" button on an email opens the ticket creation form
- [ ] Ticket form pre-fills subject from email subject and description from email body
- [ ] Priority, category, and assignment fields are functional
- [ ] Creating a ticket removes the email from the inbox and adds it to tickets
- [ ] Status advancement button works (open → in-progress → resolved → closed → open)
- [ ] Assignment dropdown updates ticket assignment
- [ ] Metrics panel shows correct stats, breakdowns, and average resolution time
- [ ] Responsive layout works at mobile widths
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] aria-\* attributes are present (role, aria-label, aria-selected, aria-busy, aria-live)
