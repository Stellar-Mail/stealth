# Folder and mailbox taxonomy

Defines the demo folders and mailbox groups used to organize seeded messages in the demo admin dashboard. All data is fake, deterministic, and safe for public review. Nothing here is wired into production mail flows.

## Folders

| Folder  | Group     | Holds                                             |
| ------- | --------- | ------------------------------------------------- |
| Inbox   | primary   | Incoming demo messages not yet filed away.        |
| Sent    | primary   | Demo messages sent from the seeded account.       |
| Drafts  | primary   | Unsent demo drafts saved for later.               |
| Snoozed | organized | Messages hidden until a scheduled reference time. |
| Archive | organized | Messages kept for reference but out of the inbox. |
| Spam    | review    | Messages flagged as unwanted and pending review.  |
| Trash   | system    | Deleted messages awaiting cleanup.                |

## Mailbox groups

- **primary** — everyday folders surfaced first in the demo UI.
- **organized** — folders for messages set aside (snoozed, archived).
- **review** — folders needing a maintainer decision (spam).
- **system** — lifecycle folders managed automatically (trash).

## Usage

`FOLDER_DEFINITIONS` maps each folder to its label, group, and description. `getFoldersForGroup(group)` returns the folders in a group, and `getFolderDefinition(folder)` returns a single folder's metadata. `DEFAULT_FOLDER` is `inbox`. The `FolderTaxonomySelector` component renders a labeled dropdown of folders with the selected folder's description and group.

## Follow-up

Wiring these folders into the live inbox, reader, or routing is intentionally out of scope and should be handled as a separate change outside this folder.
