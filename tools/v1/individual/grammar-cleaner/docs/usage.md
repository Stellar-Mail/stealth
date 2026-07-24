# Usage Guide

The Grammar Cleaner tool provides a service to clean and correct common grammar issues in text.

## API

### `cleanGrammar(text: string): GrammarCleanResult`

Cleans the input text for grammar and common typos.

**Parameters:**

- `text`: The raw text to be cleaned.

**Returns:**

- `GrammarCleanResult`: An object containing:
  - `original`: The original input text.
  - `cleaned`: The cleaned version of the text.
  - `changesCount`: The number of changes applied.

## Example

```typescript
import { cleanGrammar } from "./services/grammarCleaner";

const result = cleanGrammar("i recieved teh package");
console.log(result.cleaned); // "I received the package."
console.log(result.changesCount); // 3
```

## Features

- **Typos**: Corrects common typos (e.g., "teh" -> "the", "recieve" -> "receive").
- **Capitalization**: Ensures sentences start with a capital letter.
- **Punctuation**: Adds a period to the end of sentences if missing.
- **Whitespace**: Normalizes multiple spaces into a single space and trims edges.
