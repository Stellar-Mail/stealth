# Email Translator — Usage Guide

## Overview

This guide demonstrates how to use the Email Translator tool components in isolation. The tool is not yet integrated into the main application.

---

## Basic Usage

### Import the Main Component

```typescript
import { EmailTranslatorTool } from "./tools/v2/individual/email-translator";
```

### Render the Tool

```tsx
function MyPage() {
  return (
    <div>
      <EmailTranslatorTool />
    </div>
  );
}
```

---

## Component Props

### EmailTranslatorTool

The main tool component accepts optional props:

```typescript
interface EmailTranslatorToolProps {
  sourceText?: string; // Pre-populate source text
  onTranslated?: (text: string) => void; // Callback when translation completes
}
```

#### Example: Pre-populated Text

```tsx
<EmailTranslatorTool sourceText="Hello, this is a test email." />
```

#### Example: Translation Callback

```tsx
<EmailTranslatorTool
  onTranslated={(translatedText) => {
    console.log("Translation complete:", translatedText);
    // Handle the translated text (e.g., copy to compose area)
  }}
/>
```

---

## Using Individual Components

You can also use individual components for custom layouts:

### Language Selector

```tsx
import { LanguageSelector } from "./tools/v2/individual/email-translator/components";
import { SUPPORTED_LANGUAGES } from "./tools/v2/individual/email-translator/services";

function MyComponent() {
  const [language, setLanguage] = useState("en");

  return (
    <LanguageSelector
      id="my-language-selector"
      label="Choose Language"
      languages={SUPPORTED_LANGUAGES}
      selectedLanguage={language}
      onLanguageChange={setLanguage}
    />
  );
}
```

### Translation Input

```tsx
import { TranslationInput } from "./tools/v2/individual/email-translator/components";

function MyComponent() {
  const [text, setText] = useState("");

  return (
    <TranslationInput value={text} onChange={setText} placeholder="Enter text to translate..." />
  );
}
```

### Translation Output

```tsx
import { TranslationOutput } from "./tools/v2/individual/email-translator/components";

function MyComponent() {
  return (
    <TranslationOutput
      text="Hola, esto es una prueba."
      sourceLanguage="English"
      targetLanguage="Spanish"
    />
  );
}
```

---

## Using Hooks

### useTranslation Hook

```tsx
import { useTranslation } from "./tools/v2/individual/email-translator/hooks";

function MyComponent() {
  const { translatedText, isTranslating, error, translate, reset } = useTranslation();

  const handleTranslate = async () => {
    await translate("Hello world", "en", "es");
  };

  return (
    <div>
      <button onClick={handleTranslate} disabled={isTranslating}>
        Translate
      </button>
      {isTranslating && <p>Translating...</p>}
      {error && <p>Error: {error.message}</p>}
      {translatedText && <p>Result: {translatedText}</p>}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### useLanguageDetect Hook

```tsx
import { useLanguageDetect } from "./tools/v2/individual/email-translator/hooks";
import { getLanguageByCode } from "./tools/v2/individual/email-translator/services";

function MyComponent() {
  const [text, setText] = useState("");

  const { detectedLanguage, confidence, isDetecting } = useLanguageDetect({
    text,
    enabled: true,
    debounceMs: 500,
  });

  const language = detectedLanguage ? getLanguageByCode(detectedLanguage) : null;

  return (
    <div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      {isDetecting && <p>Detecting language...</p>}
      {language && (
        <p>
          Detected: {language.name} ({Math.round((confidence || 0) * 100)}%)
        </p>
      )}
    </div>
  );
}
```

---

## Using Services Directly

### Translation Service

```typescript
import { translationService } from "./tools/v2/individual/email-translator/services";

async function translateText() {
  const result = await translationService.translate({
    text: "Hello world",
    sourceLanguage: "en",
    targetLanguage: "es",
  });

  if (result.success) {
    console.log("Translation:", result.result.translatedText);
  } else {
    console.error("Error:", result.error.message);
  }
}
```

### Language Detection

```typescript
import { translationService } from "./tools/v2/individual/email-translator/services";

async function detectLanguage() {
  const result = await translationService.detectLanguage("Hello world");

  if ("error" in result) {
    console.error("Error:", result.error.message);
  } else {
    console.log("Language:", result.language);
    console.log("Confidence:", result.confidence);
  }
}
```

---

## Working with Languages

### Get All Supported Languages

```typescript
import { SUPPORTED_LANGUAGES } from "./tools/v2/individual/email-translator/services";

console.log(SUPPORTED_LANGUAGES);
// [{ code: "en", name: "English", nativeName: "English" }, ...]
```

### Find a Language by Code

```typescript
import { getLanguageByCode } from "./tools/v2/individual/email-translator/services";

const spanish = getLanguageByCode("es");
if (spanish) {
  console.log(spanish.name); // "Spanish"
  console.log(spanish.nativeName); // "Español"
}
```

### Get Display Name

```typescript
import { getLanguageDisplayName } from "./tools/v2/individual/email-translator/services";

const language = { code: "es", name: "Spanish", nativeName: "Español" };
console.log(getLanguageDisplayName(language));
// Output: "Español (Spanish)"
```

---

## State Components

### Show Empty State

```tsx
import { EmailTranslatorEmptyState } from "./tools/v2/individual/email-translator/components";

<EmailTranslatorEmptyState
  title="Start translating"
  description="Enter email text to begin"
  action={<button>Load Sample</button>}
/>;
```

### Show Loading State

```tsx
import { EmailTranslatorLoadingState } from "./tools/v2/individual/email-translator/components";

<EmailTranslatorLoadingState message="Translating your email..." />;
```

### Show Error State

```tsx
import { EmailTranslatorErrorState } from "./tools/v2/individual/email-translator/components";

<EmailTranslatorErrorState
  title="Translation failed"
  details="Network connection error"
  onRetry={() => console.log("Retry clicked")}
/>;
```

---

## Keyboard Shortcuts

When using the main `EmailTranslatorTool` component:

- **Ctrl+Enter** (Cmd+Enter on Mac): Trigger translation from textarea
- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate buttons
- **Arrow keys**: Navigate language selector dropdown
- **Escape**: Close language selector dropdown

---

## Testing with Fixtures

```typescript
import { getSampleEmail } from "./tools/v2/individual/email-translator/fixtures";

// Get a sample email
const englishEmail = getSampleEmail("english", "medium");
const spanishEmail = getSampleEmail("spanish", "short");

// Use in tests or development
<EmailTranslatorTool sourceText={englishEmail} />
```

---

## Mock Translation Provider

The current implementation uses a mock provider that:

- Reverses words in the text
- Adds language indicators (e.g., `[ES] reversed text`)
- Simulates network delay (800ms for translation, 300ms for detection)
- Returns deterministic results for testing

### Replacing the Mock Provider

To add a real translation provider in the future:

1. Implement the `TranslationProvider` interface
2. Update `getTranslationProvider()` in `services/translationProvider.ts`
3. Add configuration for API keys or endpoints

Example:

```typescript
class RealTranslationProvider implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Call external API
    const response = await fetch("https://api.example.com/translate", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    // Call external API
    const response = await fetch("https://api.example.com/detect", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return response.json();
  }
}
```

---

## Integration Notes

This tool is **not yet integrated** into the main application. When integrating:

1. Create an adapter in the main app (not in this folder)
2. Pass email body text as props from the mail UI
3. Register navigation/actions in main app routing
4. Keep this folder as the source of truth for translation logic

See `ARCHITECTURE.md` for complete integration guidelines.
