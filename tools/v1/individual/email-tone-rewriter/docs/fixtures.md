# Email Tone Rewriter Fixtures

Use these fixture shapes when executable tests are added. They are intentionally
plain JSON-like records so the future implementation can adapt them to its test
runner without importing app-level compose code.

## Fixture: Formal Rewrite

```json
{
  "id": "tone-formal-follow-up",
  "subject": "Following up",
  "bodyText": "Hey Sam, can you send the Q3 invoice by Friday? We need it before the launch review.",
  "tone": "formal",
  "maxWords": 80
}
```

Expected rewrite:

- keeps the recipient name `Sam`;
- keeps `Q3 invoice`, `Friday`, and `launch review`;
- sounds formal without adding new facts;
- send/save flags remain disabled.

## Fixture: Friendly Rewrite

```json
{
  "id": "tone-friendly-apology",
  "subject": "Delay update",
  "bodyText": "The report is late. I will send it tomorrow morning.",
  "tone": "friendly",
  "maxWords": 60
}
```

Expected rewrite:

- keeps the delay and tomorrow-morning delivery promise;
- softens the tone;
- does not invent a reason for the delay.

## Fixture: Unsupported Tone

```json
{
  "id": "tone-unsupported",
  "subject": "Unsupported tone",
  "bodyText": "Please review this draft.",
  "tone": "sarcastic",
  "maxWords": 50
}
```

Expected outcome:

- no rewrite is created;
- validation explains that the tone is unsupported.
