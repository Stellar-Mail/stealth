# Demo Message Generation

This utility provides a safe, deterministic way to generate realistic demo email messages for populating the Demo Admin Dashboard UI. It is fully isolated and operates on in-memory data, ensuring it is safe for a public repository.

## Architecture

- **`generateDemoMessages` (`messageGeneration.ts`):** The core function that takes a set of options, including sender personas, message templates, and a seed string, to produce an array of `PresetMail` objects.
- **Deterministic Seeding:** A simple, seed-based pseudo-random number generator is used to make "random" choices (like which persona or template to use). This guarantees that providing the same seed will always result in the exact same set of generated messages, which is critical for stable tests and demos.
- **Data Composition:** The generator combines data from different sources (personas, templates) to create varied and realistic-looking message content.

## Usage Example

```typescript
import { generateDemoMessages } from "./messageGeneration";
import { fakePersonas } from "./fixtures";
import { messageTemplates } from "./templates";

const generatedMessages = generateDemoMessages({
  count: 10,
  personas: fakePersonas,
  templates: messageTemplates,
  seed: "my-stable-demo-seed",
});

// `generatedMessages` is now an array of 10 `PresetMail` objects
// that can be used to populate the mail list in the demo UI.
```

## Future Integrations

This utility can be wired into a "Generate Data" panel in the dashboard, allowing maintainers to quickly create new datasets for different scenarios. The `seed` can be tied to a text input or generated from the current date to allow for both repeatable and fresh data generation.
