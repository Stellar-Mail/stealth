# Test Fixtures

The Grammar Cleaner tool includes a set of fixtures to ensure consistent behavior across different text scenarios. These are located in `services/fixtures.ts`.

## Fixture Categories

- **Simple Case**: Lowercase text without ending punctuation.
  - _Input_: `this is a test`
  - _Expected_: `This is a test.`
- **Common Typos**: Words frequently misspelled.
  - _Input_: `i recieved teh package yesterday`
  - _Expected_: `I received the package yesterday.`
- **Multiple Sentences**: Handling sentence boundaries.
  - _Input_: `hello there. how are you today? it is sunny`
  - _Expected_: `Hello there. How are you today? It is sunny.`
- **Whitespace**: Cleaning up irregular spacing.
  - _Input_: `Too much    space here `
  - _Expected_: `Too much space here.`
- **Case Preservation**: Maintaining capitalization on corrected typos.
  - _Input_: `Teh adress is wrong`
  - _Expected_: `The address is wrong.`

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
