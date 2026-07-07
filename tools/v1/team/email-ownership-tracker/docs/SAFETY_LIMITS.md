# Email Ownership Tracker Safety Limits

## Threat Assumptions

Email Ownership Tracker will eventually receive shared-inbox events, ownership
updates, attachment metadata, and team member data from the mail product. Until
an integration issue exists, every external value in this tool folder is treated
as untrusted:

- event ids and message ids can contain path traversal, URL fragments, HTML, or
  whitespace that should never become storage keys.
- owner, actor, and team member emails can contain malformed addresses or CRLF
  header-injection payloads.
- owner names, reasons, and tags can contain control characters, HTML-like text,
  or oversized strings.
- attachment metadata can be malformed, negative, or inflated to force expensive
  accounting.
- ownership histories can contain many stale events from shared mailbox imports.

## Unsafe Input Handling

`guards/ownership-boundaries.mjs` provides pure, synchronous helpers that future
services or hooks can call before rendering, storage, notifications, or network
work. The guards:

- reject unsafe ids before they can be used as keys or paths.
- normalize emails to lowercase and reject CRLF or null-byte payloads.
- allow only known ownership actions: `claim`, `assign`, `transfer`, `release`,
  and `escalate`.
- sanitize primitive display text by removing control characters and HTML-like
  tags, then truncating to field budgets.
- validate attachment metadata only; this tool must not inspect attachment file
  bodies in the isolated folder.
- require pagination for oversized histories and team member lists.

The guard layer intentionally does not HTML-escape for a specific renderer. Any
future UI must still escape output according to the rendering framework.

## Performance Limits

Default budgets are deliberately small enough for a V1 launch tool:

| Budget            | Default | Reason                                           |
| ----------------- | ------: | ------------------------------------------------ |
| Ownership history |     500 | Bounds one-pass current-owner derivation.        |
| Team members      |     250 | Prevents scanning large directories in one view. |
| Attachments       |      30 | Keeps metadata checks cheap.                     |
| Attachment bytes  |   50 MB | Caps aggregate accounting for one event.         |
| Reason text       |   1,200 | Avoids rendering imported email threads.         |
| Tags              |      20 | Prevents unbounded filters and chips.            |

Future integration should run these guards before any inbox read, ownership
write, notification fanout, background job, or analytics update. Larger
histories should be paginated and summarized outside the request path.
