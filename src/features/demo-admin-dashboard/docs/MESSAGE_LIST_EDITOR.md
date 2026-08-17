# Message list editor data model

Defines the editable message-list model that admin users work with when managing demo inbox conversations. All data is fake, deterministic, and safe for public review. Nothing here is wired into production mail flows.

## Editable message

Each `EditableMessage` has: `id`, `subject`, `sender`, `preview`, `folder`, `unread`, and `starred`. The `folder` is one of the supported demo folders.

## Field metadata

`MESSAGE_FIELDS` describes each editable field with a `key`, `label`, input `type` (`text`, `longtext`, `folder`, or `boolean`), a `required` flag, and `helpText`. Use `getMessageField(key)` to look up a single field's metadata for rendering an editor form.

## Defaults and folder support

`createEmptyMessage(id)` returns a blank message that is unread, not starred, and filed in `DEFAULT_MESSAGE_FOLDER` (`inbox`). `MESSAGE_FOLDERS` lists the folders a message can be filed under.

## Fixtures

`messageListFixtures` provides a small, deterministic set of example messages for previewing the editor.

## Follow-up

Wiring this model into the live inbox or reader is intentionally out of scope and should be handled as a separate change outside this folder.
