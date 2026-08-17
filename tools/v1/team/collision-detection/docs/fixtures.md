# Collision Detection Fixtures

Use these fixture shapes when executable tests are added. They are intentionally
plain JSON-like records so the future implementation can adapt them to its test
runner without importing app-level inbox code.

## Fixture: Two-Reply Collision

```json
{
  "id": "two-reply-collision",
  "description": "Two teammates replying to the same thread simultaneously.",
  "replies": [
    {
      "userId": "user-1",
      "userName": "Alex Chen",
      "threadId": "thread-101",
      "startedAt": "2026-06-23T09:00:00Z",
      "preview": "Re: Q3 Budget Review"
    },
    {
      "userId": "user-2",
      "userName": "Jordan Lee",
      "threadId": "thread-101",
      "startedAt": "2026-06-23T09:01:00Z",
      "preview": "Re: Q3 Budget Review"
    }
  ],
  "expectedEventCount": 1
}
```

Expected outcome:

- one `CollisionEvent` with `severity: "warning"` is produced.

## Fixture: Three-Reply Critical Collision

```json
{
  "id": "three-reply-critical",
  "description": "Three teammates replying to the same thread.",
  "replies": [
    {
      "userId": "user-1",
      "userName": "Alex Chen",
      "threadId": "thread-202",
      "startedAt": "2026-06-23T10:00:00Z",
      "preview": "Re: Deploy Schedule"
    },
    {
      "userId": "user-3",
      "userName": "Morgan Smith",
      "threadId": "thread-202",
      "startedAt": "2026-06-23T10:02:00Z",
      "preview": "Re: Deploy Schedule"
    },
    {
      "userId": "user-4",
      "userName": "Taylor Wu",
      "threadId": "thread-202",
      "startedAt": "2026-06-23T10:03:00Z",
      "preview": "Re: Deploy Schedule"
    }
  ],
  "expectedEventCount": 1
}
```

Expected outcome:

- one `CollisionEvent` with `severity: "critical"` is produced.

## Fixture: No Collision

```json
{
  "id": "no-collision",
  "description": "All replies to different threads.",
  "replies": [
    {
      "userId": "user-1",
      "userName": "Alex Chen",
      "threadId": "thread-301",
      "startedAt": "2026-06-23T11:00:00Z"
    },
    {
      "userId": "user-2",
      "userName": "Jordan Lee",
      "threadId": "thread-302",
      "startedAt": "2026-06-23T11:05:00Z"
    }
  ],
  "expectedEventCount": 0
}
```

Expected outcome:

- no `CollisionEvent` objects are produced.
