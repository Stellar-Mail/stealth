# Grammar Cleaner Fixtures

All fixtures are synthetic text samples. None contain real personal data.

## Fixture: common-errors

Text with homophone and capitalization errors.

Input:

```
i think there going to the meeting tomorrow. Your the best candidate for the role. Its important to recieve the documents before friday.
```

Expected corrections:

- "i" → "I"
- "there" → "they're"
- "Your" → "You're"
- "Its" → "It's"
- "recieve" → "receive"
- "friday" → "Friday" (via sentence capitalization)

## Fixture: redundant-fillers

Text with filler words and redundancy.

Input:

```
I just wanted to basically say that we are very happy with the results. The team really did an actually amazing job on this project.
```

Expected: "just", "basically", "very", "really", "actually" are removed.

## Fixture: punctuation-issues

Text with punctuation and spacing issues.

Input:

```
Please send the report , the invoice , and the summary .  We need them soon .
```

Expected: spaces before punctuation are removed, double space is collapsed.

## Fixture: mixed-errors

Text with multiple types of grammar issues.

Input:

```
i would of called you earlier but i accidently lost youre number. Theirs alot of work to do before the deadline .  Please confirm the calender invite.
```

Expected corrections:

- "i" → "I"
- "would of" → "would have"
- "accidently" → no rule matches, but surrounding fixes apply
- "youre" → "you're"
- "Theirs" → "There's"
- "alot" → "a lot"
- Punctuation spacing fixed
- "calender" → "calendar"
